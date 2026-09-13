package main

import "testing"

func TestSelectAtendeTargetSkipsInternalChromePage(t *testing.T) {
	targets := []chromeTarget{
		{Type: "page", URL: "chrome://newtab/", WebSocketDebuggerURL: "ws://internal"},
		{Type: "page", URL: "https://apucarana.atende.net/atende.php", WebSocketDebuggerURL: "ws://atende"},
	}
	got, err := selectAtendeTarget(targets)
	if err != nil { t.Fatal(err) }
	if got != "ws://atende" { t.Fatalf("esperava alvo do Atende.Net, recebeu %q", got) }
}

func TestSelectAtendeTargetWaitsWhenAtendeNotLoaded(t *testing.T) {
	targets := []chromeTarget{{Type: "page", URL: "chrome://newtab/", WebSocketDebuggerURL: "ws://internal"}}
	if _, err := selectAtendeTarget(targets); err == nil {
		t.Fatal("esperava erro enquanto a aba do Atende.Net ainda não carregou")
	}
}
