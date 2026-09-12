package main

import (
	"bufio"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type chromeTarget struct {
	Type                 string `json:"type"`
	URL                  string `json:"url"`
	WebSocketDebuggerURL string `json:"webSocketDebuggerUrl"`
}

type wsClient struct {
	conn   net.Conn
	reader *bufio.Reader
	mu     sync.Mutex
	nextID int
}

func discoverPage(debugURL string) (string, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(strings.TrimRight(debugURL, "/") + "/json")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var targets []chromeTarget
	if err := json.NewDecoder(resp.Body).Decode(&targets); err != nil {
		return "", err
	}
	for _, t := range targets {
		if t.Type == "page" && t.WebSocketDebuggerURL != "" {
			return t.WebSocketDebuggerURL, nil
		}
	}
	return "", errors.New("nenhuma aba do navegador foi encontrada")
}

func dialWS(rawURL string) (*wsClient, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	host := u.Host
	if !strings.Contains(host, ":") {
		host += ":80"
	}
	conn, err := net.DialTimeout("tcp", host, 5*time.Second)
	if err != nil {
		return nil, err
	}
	keyBytes := make([]byte, 16)
	if _, err := rand.Read(keyBytes); err != nil {
		conn.Close()
		return nil, err
	}
	key := base64.StdEncoding.EncodeToString(keyBytes)
	path := u.RequestURI()
	req := fmt.Sprintf("GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\nOrigin: http://localhost\r\n\r\n", path, u.Host, key)
	if _, err := io.WriteString(conn, req); err != nil {
		conn.Close()
		return nil, err
	}
	reader := bufio.NewReader(conn)
	status, err := reader.ReadString('\n')
	if err != nil {
		conn.Close()
		return nil, err
	}
	if !strings.Contains(status, "101") {
		conn.Close()
		return nil, fmt.Errorf("websocket recusado: %s", strings.TrimSpace(status))
	}
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			conn.Close()
			return nil, err
		}
		if line == "\r\n" {
			break
		}
	}
	return &wsClient{conn: conn, reader: reader}, nil
}

func (w *wsClient) Close() { _ = w.conn.Close() }

func (w *wsClient) writeText(payload []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	header := []byte{0x81}
	n := len(payload)
	switch {
	case n < 126:
		header = append(header, byte(n)|0x80)
	case n <= 65535:
		header = append(header, 126|0x80, byte(n>>8), byte(n))
	default:
		header = append(header, 127|0x80)
		b := make([]byte, 8)
		binary.BigEndian.PutUint64(b, uint64(n))
		header = append(header, b...)
	}
	mask := make([]byte, 4)
	if _, err := rand.Read(mask); err != nil {
		return err
	}
	header = append(header, mask...)
	masked := make([]byte, n)
	for i := range payload {
		masked[i] = payload[i] ^ mask[i%4]
	}
	if _, err := w.conn.Write(append(header, masked...)); err != nil {
		return err
	}
	return nil
}

func (w *wsClient) readText() ([]byte, error) {
	for {
		b0, err := w.reader.ReadByte()
		if err != nil {
			return nil, err
		}
		b1, err := w.reader.ReadByte()
		if err != nil {
			return nil, err
		}
		opcode := b0 & 0x0f
		masked := b1&0x80 != 0
		n := uint64(b1 & 0x7f)
		if n == 126 {
			var x uint16
			if err := binary.Read(w.reader, binary.BigEndian, &x); err != nil {
				return nil, err
			}
			n = uint64(x)
		}
		if n == 127 {
			if err := binary.Read(w.reader, binary.BigEndian, &n); err != nil {
				return nil, err
			}
		}
		var mask []byte
		if masked {
			mask = make([]byte, 4)
			if _, err := io.ReadFull(w.reader, mask); err != nil {
				return nil, err
			}
		}
		payload := make([]byte, n)
		if _, err := io.ReadFull(w.reader, payload); err != nil {
			return nil, err
		}
		if masked {
			for i := range payload {
				payload[i] ^= mask[i%4]
			}
		}
		if opcode == 0x8 {
			return nil, io.EOF
		}
		if opcode == 0x9 {
			continue
		}
		if opcode == 0x1 {
			return payload, nil
		}
	}
}

func (w *wsClient) Command(method string, params any) (map[string]any, error) {
	w.nextID++
	id := w.nextID
	msg := map[string]any{"id": id, "method": method}
	if params != nil {
		msg["params"] = params
	}
	raw, _ := json.Marshal(msg)
	if err := w.writeText(raw); err != nil {
		return nil, err
	}
	deadline := time.Now().Add(60 * time.Second)
	_ = w.conn.SetReadDeadline(deadline)
	for {
		frame, err := w.readText()
		if err != nil {
			return nil, err
		}
		var response map[string]any
		if json.Unmarshal(frame, &response) != nil {
			continue
		}
		rid, ok := response["id"].(float64)
		if !ok || int(rid) != id {
			continue
		}
		if e, ok := response["error"].(map[string]any); ok {
			return nil, fmt.Errorf("CDP %s: %v", method, e["message"])
		}
		return response, nil
	}
}

func (w *wsClient) Evaluate(expression string) (string, error) {
	response, err := w.Command("Runtime.evaluate", map[string]any{
		"expression":    expression,
		"awaitPromise":  true,
		"returnByValue": true,
		"userGesture":   true,
	})
	if err != nil {
		return "", err
	}
	result, _ := response["result"].(map[string]any)
	remote, _ := result["result"].(map[string]any)
	if subtype, _ := remote["subtype"].(string); subtype == "error" {
		return "", fmt.Errorf("javascript: %v", remote["description"])
	}
	switch value := remote["value"].(type) {
	case string:
		return value, nil
	case nil:
		return "", nil
	default:
		b, _ := json.Marshal(value)
		return string(b), nil
	}
}
