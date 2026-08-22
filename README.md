# Dashboard IDEPPLAN

Código-fonte do **Dashboard Estatístico Integrado do IDEPPLAN** — Instituto de Desenvolvimento, Pesquisa e Planejamento de Apucarana.

- Aplicação publicada: https://dashboard-estatistico-integrado.thiagohbernardi.chatgpt.site
- Tecnologias: React 19, Next.js/Vinext, TypeScript, Cloudflare D1, R2 e Drizzle ORM.

## O que está incluído

O repositório contém a aplicação completa: telas, componentes, APIs, autenticação institucional, mapas, módulos administrativos, análise documental, OCR, geração de documentos, análise de EIV, esquema do banco, migrações e testes automatizados. Modelos DOCX e tabelas PDF demonstrativos preservam o funcionamento local sem publicar documentos institucionais.

As bases operacionais reais não fazem parte do repositório público. Foram incluídos arquivos vazios compatíveis para que o projeto possa ser instalado e aberto localmente sem expor processos, proprietários, endereços, inscrições imobiliárias, coordenadas, anexos ou credenciais.

## Abrir no Visual Studio Code

### Requisitos

- [Git](https://git-scm.com/downloads)
- [Node.js 22.13 ou superior](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)

### 1. Baixar o projeto

No terminal do Visual Studio Code:

```bash
git clone https://github.com/thiagobernardiutfpr/dashboard-idepplan.git
cd dashboard-idepplan
```

Também é possível usar **Code → Download ZIP** na página do GitHub.

### 2. Instalar as dependências

```bash
npm ci
```

### 3. Configurar o login local

Copie `.env.example` para `.env.local`.

No Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

No Linux ou macOS:

```bash
cp .env.example .env.local
```

Edite `.env.local` e troque o usuário, a senha e o segredo de sessão. O segredo deve ter pelo menos 32 caracteres. Nunca envie `.env.local` ao GitHub.

### 4. Executar

```bash
npm run dev
```

Abra o endereço exibido pelo terminal, normalmente `http://localhost:5173`.

## Comandos úteis

```bash
npm run dev       # desenvolvimento local
npm run build     # compilação de produção
npm run lint      # verificação do código
npm test          # testes automatizados seguros
```

## Dados locais e produção

O desenvolvimento local usa D1 e R2 simulados pelo Wrangler. A primeira execução cria o estado local dentro da pasta ignorada `.wrangler/`.

Para reproduzir o conteúdo operacional da implantação municipal, é necessário fornecer bases autorizadas e configurar os serviços equivalentes a:

- `DB`: banco Cloudflare D1;
- `BUCKET`: armazenamento Cloudflare R2;
- `DASHBOARD_USERS_JSON`: usuários institucionais;
- `DASHBOARD_SESSION_SECRET`: assinatura das sessões.

As estruturas e migrações necessárias estão em `db/` e `drizzle/`.

Os arquivos demonstrativos de `public/document-templates/` e `public/zoning-uses/` podem ser substituídos, mantendo os mesmos nomes, pelas versões institucionais autorizadas.

## Conteúdo deliberadamente não publicado

- bancos e registros operacionais;
- inscrições imobiliárias, proprietários, documentos e endereços;
- anexos enviados pelos usuários;
- índices cadastrais, coordenadas e geometrias municipais completas;
- relatórios e testes derivados de dados reais;
- credenciais e identificadores internos da hospedagem.

O código-fonte é público; os dados institucionais continuam institucionais. A fronteira parece óbvia, mas a internet adora testar conceitos básicos.
