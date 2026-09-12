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

1. Entre normalmente no Dashboard IDEPPLAN.
2. Abra `/integracoes/atende` e clique em **Gerar nova chave**.
3. Copie a chave exibida; ela aparece apenas uma vez. O Dashboard armazena somente o hash SHA-256.
4. No Windows, defina a variável de ambiente `ATENDE_SYNC_TOKEN` com essa chave para a conta que executará a tarefa.
5. Execute `AtendeSync.exe --setup-login`.
6. Faça login normalmente no Atende.Net e aguarde a tela principal carregar.
7. Volte ao executável e pressione **Enter**. Apenas a sessão do navegador é preservada no perfil exclusivo.
8. Execute `AtendeSync.exe` para uma sincronização de teste.
9. Se o teste concluir, cadastre o executável no Agendador de Tarefas do Windows para rodar diariamente.

A variável `ATENDE_SYNC_TOKEN` configurada no ambiente do servidor continua aceita apenas como fallback de compatibilidade, mas não é mais necessária quando uma chave D1 foi gerada pelo painel.

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
