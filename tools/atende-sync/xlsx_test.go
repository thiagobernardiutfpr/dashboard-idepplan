package main

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func TestParseAtendeVerticalXLSX(t *testing.T) {
	path := filepath.Join(t.TempDir(), "relatorio.xlsx")
	f, err := os.Create(path)
	if err != nil { t.Fatal(err) }
	zw := zip.NewWriter(f)
	sheet, err := zw.Create("xl/worksheets/sheet1.xml")
	if err != nil { t.Fatal(err) }
	xml := `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>Processo</t></is></c><c r="B1" t="inlineStr"><is><t>Situação</t></is></c><c r="E1" t="inlineStr"><is><t>Requerente</t></is></c><c r="J1" t="inlineStr"><is><t>Data Abertura</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>12345/2026</t></is></c><c r="B2" t="inlineStr"><is><t>Trâmite</t></is></c><c r="E2" t="inlineStr"><is><t>MARIA TESTE</t></is></c><c r="J2" t="inlineStr"><is><t>12/09/2026</t></is></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>Assunto:</t></is></c><c r="B3" t="inlineStr"><is><t>92 - WEB - Secretaria de Obras</t></is></c></row>
<row r="4"><c r="A4" t="inlineStr"><is><t>Subassunto:</t></is></c><c r="B4" t="inlineStr"><is><t>1279 - WEB - Certidão de Endereço</t></is></c></row>
<row r="5"><c r="A5" t="inlineStr"><is><t>Observação:</t></is></c><c r="B5" t="inlineStr"><is><t>LOTE: 24 Q: 04 B: TEXAS IMOB: 116.243.0451.001 RUA APARECIDA ALVES VICENTE Nº 100</t></is></c></row>
<row r="6"><c r="A6" t="inlineStr"><is><t>12346/2026</t></is></c><c r="B6" t="inlineStr"><is><t>Abertura</t></is></c><c r="E6" t="inlineStr"><is><t>JOÃO TESTE</t></is></c><c r="J6" t="inlineStr"><is><t>13/09/2026</t></is></c></row>
<row r="7"><c r="A7" t="inlineStr"><is><t>Subassunto:</t></is></c><c r="B7" t="inlineStr"><is><t>1037 - EXCLUIR</t></is></c></row>
</sheetData></worksheet>`
	if _, err := sheet.Write([]byte(xml)); err != nil { t.Fatal(err) }
	if err := zw.Close(); err != nil { t.Fatal(err) }
	if err := f.Close(); err != nil { t.Fatal(err) }

	got, err := ParseAtendeXLSX(path)
	if err != nil { t.Fatal(err) }
	if len(got) != 1 { t.Fatalf("esperava 1 processo após exclusão, recebeu %d", len(got)) }
	p := got[0]
	if p.ProcessNumber != "12345/2026" || p.Applicant != "MARIA TESTE" || p.Status != "Trâmite" { t.Fatalf("processo básico incorreto: %#v", p) }
	if p.OpenedAt != "2026-09-12" { t.Fatalf("data incorreta: %s", p.OpenedAt) }
	if p.PropertyRegistration != "116.243.0451.001" || p.Lot != "24" || p.Block != "04" { t.Fatalf("extração imobiliária incorreta: %#v", p) }
}
