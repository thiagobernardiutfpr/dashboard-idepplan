package main

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// Labels intentionally mirrored from the Atende.Net vertical report: assunto:, subassunto:, observacao:.
const labelAssunto = "assunto:"
const labelSubassunto = "subassunto:"
const labelObservacao = "observacao:"

var processPattern = regexp.MustCompile(`^\s*\d+/\d{4}\s*$`)
var excludedSubsubjects = map[string]bool{"1037": true, "1076": true, "1090": true, "1159": true, "1119": true, "985": true, "609": true, "948": true}

type AtendeProcess struct {
	ProcessNumber        string `json:"processNumber"`
	Applicant            string `json:"applicant"`
	Status               string `json:"status"`
	OpenedAt             string `json:"openedAt,omitempty"`
	Subject              string `json:"subject,omitempty"`
	Subsubject           string `json:"subsubject,omitempty"`
	Lot                  string `json:"lot,omitempty"`
	Block                string `json:"block,omitempty"`
	PropertyRegistration string `json:"propertyRegistration,omitempty"`
	Neighborhood         string `json:"neighborhood,omitempty"`
	Street               string `json:"street,omitempty"`
	Observation          string `json:"observation,omitempty"`
	ClosedAt             string `json:"closedAt,omitempty"`
	CloseReason          string `json:"closeReason,omitempty"`
}

type sst struct { Items []si `xml:"si"` }
type si struct { Text string `xml:"t"`; Runs []struct { Text string `xml:"t"` } `xml:"r"` }
type worksheet struct { Rows []sheetRow `xml:"sheetData>row"` }
type sheetRow struct { Cells []sheetCell `xml:"c"` }
type sheetCell struct {
	Ref string `xml:"r,attr"`; Type string `xml:"t,attr"`; Value string `xml:"v"`
	Inline struct { Text string `xml:"t"`; Runs []struct { Text string `xml:"t"` } `xml:"r"` } `xml:"is"`
}

func readZipFile(zr *zip.ReadCloser, name string) ([]byte, error) {
	for _, f := range zr.File { if f.Name == name { r, err := f.Open(); if err != nil { return nil, err }; defer r.Close(); return io.ReadAll(r) } }
	return nil, fmt.Errorf("arquivo %s não encontrado", name)
}

func sharedStrings(zr *zip.ReadCloser) []string {
	raw, err := readZipFile(zr, "xl/sharedStrings.xml"); if err != nil { return nil }
	var table sst; if xml.Unmarshal(raw, &table) != nil { return nil }
	out := make([]string, 0, len(table.Items)); for _, item := range table.Items { text := item.Text; for _, run := range item.Runs { text += run.Text }; out = append(out, text) }; return out
}

func colIndex(ref string) int { n := 0; for _, r := range ref { if r < 'A' || r > 'Z' { break }; n = n*26 + int(r-'A'+1) }; return n-1 }
func cellText(c sheetCell, shared []string) string {
	switch c.Type { case "s": i,_:=strconv.Atoi(c.Value); if i>=0 && i<len(shared){return shared[i]}; case "inlineStr": text:=c.Inline.Text; for _,run:=range c.Inline.Runs{text+=run.Text}; return text; default:return c.Value }; return ""
}
func readSheet(raw []byte, shared []string) ([][]string,error) {
	var ws worksheet; if err:=xml.Unmarshal(raw,&ws);err!=nil{return nil,err}; rows:=make([][]string,0,len(ws.Rows))
	for _,row:=range ws.Rows {max:=-1; values:=map[int]string{}; for _,c:=range row.Cells{idx:=colIndex(c.Ref);if idx<0{continue};values[idx]=cellText(c,shared);if idx>max{max=idx}};if max<0{rows=append(rows,nil);continue};out:=make([]string,max+1);for i,v:=range values{out[i]=v};rows=append(rows,out)};return rows,nil
}
func cleanText(v string) string{return strings.Join(strings.Fields(strings.TrimSpace(v))," ")}
func normalizeLabel(v string) string {v=strings.ToLower(cleanText(v));repl:=strings.NewReplacer("á","a","à","a","ã","a","â","a","é","e","ê","e","í","i","ó","o","ô","o","õ","o","ú","u","ç","c");return repl.Replace(v)}
func parseDate(v string) string {s:=cleanText(v);if s==""{return ""};if n,err:=strconv.ParseFloat(strings.ReplaceAll(s,",","."),64);err==nil&&n>25000&&n<80000{base:=time.Date(1899,12,30,0,0,0,0,time.UTC);return base.Add(time.Duration(n*24)*time.Hour).Format("2006-01-02")};for _,layout:=range []string{"02/01/2006 15:04:05","02/01/2006 15:04","02/01/2006","2006-01-02"}{if t,err:=time.Parse(layout,s);err==nil{if strings.Contains(layout,"15"){return t.Format("2006-01-02T15:04:05")};return t.Format("2006-01-02")}};return s}
func rowValue(row []string,idx int)string{if idx>=0&&idx<len(row){return cleanText(row[idx])};return ""}
func rightValue(row []string,idx int)string{for i:=idx+1;i<len(row);i++{if v:=cleanText(row[i]);v!=""{return v}};return ""}
func firstRegex(text string,patterns ...string)string{for _,p:=range patterns{re:=regexp.MustCompile(p);if m:=re.FindStringSubmatch(text);len(m)>1{return cleanText(strings.Trim(m[1]," :;,-."))}};return ""}
func enrichProperty(p *AtendeProcess){t:=p.Observation;p.Lot=firstRegex(t,`(?i)\bLOTE\b\s*[:\-]?\s*([A-Z0-9./\-]+(?:\s+REM)?)`,`(?i)\bLT\s*[:\-]?\s*([A-Z0-9./\-]+)`);p.Block=firstRegex(t,`(?i)\b(?:QUADRA|QUASDRA|QD)\b\s*[:\-]?\s*([A-Z0-9./\-]+)`,`(?i)\bQ\s*:\s*([A-Z0-9./\-]+)`);p.PropertyRegistration=firstRegex(t,`(?i)(?:INSCRI[CÇ][AÃ]O\s+IMOBILI[AÁ]RIA|INSC\.?\s*IMOB\.?|IMOBILI[AÁ]RIA|IMOB)\s*(?:[:=\-]\s*|\s+)([0-9][0-9.\-/]*)`);p.Neighborhood=firstRegex(t,`(?i)\b(?:BAIRRO|BAIRR\.?)\b\s*[:\-]?\s*([^;|]+?)(?:\s+(?:IMOB|LOTE|QUADRA|RUA|AVENIDA)\b|$)`,`(?i)\bB\s*:\s*([^;|]+?)(?:\s+(?:IMOB|LOTE|Q\s*:|RUA|AVENIDA)\b|$)`);p.Street=firstRegex(t,`(?i)\b(?:RUA|AVENIDA|ESTRADA|RODOVIA|ALAMEDA)\s+(.+?)(?:\s+(?:N[º°]?|NUMERO|CEP|CONFORME|LOTE|QUADRA|IMOB)\b|$)`)}
func completeness(p AtendeProcess)int{vals:=[]string{p.Applicant,p.Status,p.OpenedAt,p.Subject,p.Subsubject,p.Lot,p.Block,p.PropertyRegistration,p.Neighborhood,p.Street,p.Observation,p.ClosedAt,p.CloseReason};n:=0;for _,v:=range vals{if v!=""{n++}};return n}
func parseVerticalRows(rows [][]string)([]AtendeProcess,bool){
	header,pc,sc,rc,dc:=-1,0,1,4,9;limit:=len(rows);if limit>20{limit=20};for i:=0;i<limit;i++{for j,c:=range rows[i]{n:=normalizeLabel(c);if n=="processo"{pc=j};if n=="situacao"{sc=j}};foundP,foundS:=false,false;for _,c:=range rows[i]{n:=normalizeLabel(c);if n=="processo"{foundP=true};if n=="situacao"{foundS=true};if n=="requerente"{rc=indexOf(rows[i],c)};if n=="data abertura"||n=="data de abertura"{dc=indexOf(rows[i],c)}};if foundP&&foundS{header=i;break}};if header<0{return nil,false}
	var out []AtendeProcess;var cur *AtendeProcess;finish:=func(){if cur==nil{return};enrichProperty(cur);out=append(out,*cur);cur=nil};for _,row:=range rows[header+1:]{proc:=rowValue(row,pc);if processPattern.MatchString(proc){finish();cur=&AtendeProcess{ProcessNumber:proc,Applicant:rowValue(row,rc),Status:rowValue(row,sc),OpenedAt:parseDate(rowValue(row,dc))};continue};if cur==nil{continue};for i,c:=range row{lab:=normalizeLabel(c);switch{case lab==labelAssunto:cur.Subject=rightValue(row,i);case lab==labelSubassunto:cur.Subsubject=rightValue(row,i);case lab==labelObservacao||lab=="observacoes gerais:":v:=rightValue(row,i);if v!=""{if cur.Observation!=""{cur.Observation+=" "};cur.Observation+=v};case strings.Contains(lab,"data/hora encerramento:")||strings.Contains(lab,"data hora encerramento:"):cur.ClosedAt=parseDate(rightValue(row,i));case strings.Contains(lab,"motivo encerramento:"):cur.CloseReason=rightValue(row,i)}}};finish();filtered:=make([]AtendeProcess,0,len(out));unique:=map[string]AtendeProcess{};for _,p:=range out{skip:=false;for code:=range excludedSubsubjects{if regexp.MustCompile(`(^|\D)`+regexp.QuoteMeta(code)+`(\D|$)`).MatchString(p.Subsubject){skip=true;break}};if skip{continue};old,ok:=unique[p.ProcessNumber];if !ok||completeness(p)>completeness(old){unique[p.ProcessNumber]=p}};keys:=make([]string,0,len(unique));for k:=range unique{keys=append(keys,k)};sort.Strings(keys);for _,k:=range keys{filtered=append(filtered,unique[k])};return filtered,true
}
func indexOf(row []string,value string)int{for i,v:=range row{if v==value{return i}};return -1}
func ParseAtendeXLSX(path string)([]AtendeProcess,error){zr,err:=zip.OpenReader(path);if err!=nil{return nil,err};defer zr.Close();shared:=sharedStrings(zr);for _,f:=range zr.File{if !strings.HasPrefix(f.Name,"xl/worksheets/sheet")||!strings.HasSuffix(f.Name,".xml"){continue};r,err:=f.Open();if err!=nil{continue};raw,_:=io.ReadAll(r);r.Close();rows,err:=readSheet(raw,shared);if err!=nil{continue};if processes,ok:=parseVerticalRows(rows);ok&&len(processes)>0{return processes,nil}};return nil,fmt.Errorf("não foi possível reconhecer o relatório vertical do Atende.Net")}
func stripAccents(s string)string{return strings.Map(func(r rune)rune{if unicode.Is(unicode.Mn,r){return -1};return r},s)}
