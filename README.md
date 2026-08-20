# Dashboard IDEPPLAN

Código-fonte do **Dashboard Estatístico Integrado do IDEPPLAN** — Instituto de Desenvolvimento, Pesquisa e Planejamento de Apucarana.

Aplicação pública: https://dashboard-estatistico-integrado.thiagohbernardi.chatgpt.site

## Conteúdo deste repositório

O repositório contém a aplicação em Next.js/Vinext, componentes, rotas, esquema do banco de dados e arquivos de configuração não sigilosos.

Para permitir compilação segura, as bases locais incluídas são apenas estruturas vazias. Os dados operacionais são fornecidos no ambiente de produção.

## Dados não versionados

Por segurança e proteção de dados, não são publicados:

- bancos e registros operacionais;
- inscrições imobiliárias, proprietários, documentos e endereços;
- anexos enviados pelos usuários;
- índices cadastrais, coordenadas e geometrias municipais;
- relatórios, testes derivados de dados reais e credenciais;
- identificadores internos do ambiente de hospedagem.

## Desenvolvimento

Requisitos: Node.js 22.13 ou superior.

```bash
npm ci
npm run build
```

As integrações persistentes exigem os bindings `DB` (D1) e `BUCKET` (R2) no ambiente de hospedagem.
