# AtendeSync - IDEPPLAN

Sincronizador do **Relatório Estatístico por Centro de Custos** do Atende.Net para o Dashboard Estatístico Integrado.

## Como funciona

1. Abre Chrome ou Edge com um perfil exclusivo e persistente.
2. Reutiliza a sessão autenticada do Atende.Net; a senha não é armazenada pelo executável.
3. Emite o relatório anual no formato XLSX usando as requisições internas identificadas no fluxo real do Atende.Net.
4. Aguarda o relatório finalizar na fila, obtém `ReportEmissao.id` e `Upload.idArquivo` e baixa o XLSX.
5. Converte o relatório vertical para um registro por processo, preservando assunto, subassunto, situação e dados imobiliários extraídos.
6. Envia os processos para `/api/integrations/atende/processes`, que faz UPSERT e registra histórico de mudança de situação.

## Primeiro uso

1. Configure no ambiente do dashboard a variável `ATENDE_SYNC_TOKEN` com um token aleatório de pelo menos 32 caracteres.
2. No Windows, crie a mesma variável de ambiente `ATENDE_SYNC_TOKEN` para a conta que executará a tarefa.
3. Execute `AtendeSync.exe --setup-login`.
4. Faça login normalmente no Atende.Net e aguarde a tela principal carregar.
5. Volte ao executável e pressione **Enter**. Apenas a sessão do navegador é preservada no perfil exclusivo.
6. Execute `AtendeSync.exe` para uma sincronização de teste.
7. Se o teste concluir, cadastre o executável no Agendador de Tarefas do Windows para rodar diariamente.

## Configuração

No primeiro uso é criado `config.json` ao lado do executável. Por padrão:

```json
{
  "dashboardUrl": "https://dashboard-estatistico-integrado.thiagohbernardi.chatgpt.site/api/integrations/atende/processes",
  "profileDir": "%LOCALAPPDATA%\\IDEPPLAN\\AtendeSync\\chrome-profile",
  "downloadDir": "%LOCALAPPDATA%\\IDEPPLAN\\AtendeSync\\downloads",
  "headless": true,
  "debugPort": 9222
}
```

Os caminhos reais são gravados pelo executável, já expandidos para o usuário atual.

## Agendador de Tarefas

Sugestão: uma execução diária, por exemplo às 06:00. Use a mesma conta Windows usada no `--setup-login`, pois o perfil autenticado pertence a essa conta.

Se a sessão do Atende.Net expirar, o programa encerra com erro e solicita nova execução de `AtendeSync.exe --setup-login`; ele não substitui os dados do dashboard com uma coleta incompleta.

## Compilação

O cliente usa somente a biblioteca padrão do Go:

```bash
go test ./...
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o AtendeSync.exe .
```
