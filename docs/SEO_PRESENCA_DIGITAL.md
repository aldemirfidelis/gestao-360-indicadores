# SEO, presenca digital e WhatsApp - Gestao 360

Data: 2026-06-09

## Relatorio executivo

### Problemas encontrados

- A aplicacao tinha metadata global basica, sem canonical especifico por rota publica.
- Nao havia `sitemap.xml`, `robots.txt` gerado pelo App Router, `llms.txt` ou fluxo de IndexNow.
- A landing concentrava praticamente todo o conteudo publico, sem arquitetura organica por tema.
- Rotas autenticadas ficavam protegidas por login, mas sem camada explicita de `noindex`/`X-Robots-Tag`.
- Nao havia botao publico de WhatsApp com rastreamento de clique.
- O Portal Admin Global nao tinha uma area dedicada a SEO e Presenca Digital.

### Melhorias aplicadas

- Criada arquitetura publica indexavel:
  - `/`
  - `/solucoes`
  - `/solucoes/*`
  - `/modulos`
  - `/segmentos`
  - `/segmentos/*`
  - `/recursos`
  - `/conteudos`
  - `/conteudos/guias`
  - `/conteudos/artigos`
  - `/conteudos/artigos/*`
  - `/conteudos/perguntas-frequentes`
  - `/sobre`
  - `/contato`
  - `/seguranca`
  - `/implantacao`
  - `/suporte`
  - `/politica-de-privacidade`
  - `/termos-de-uso`
- Criados metadados por rota publica: title, description, canonical, Open Graph e Twitter Card.
- Criados JSON-LD reutilizaveis: Organization, WebSite, SoftwareApplication, WebPage, BreadcrumbList, FAQPage e Article.
- Criado `sitemap.xml` automatico apenas com rotas publicas indexaveis.
- Criado `robots.txt` com bloqueio de areas privadas e permissao para `OAI-SearchBot` em paginas publicas.
- Criado `llms.txt` experimental, sem rotas privadas.
- Criado botao flutuante de WhatsApp para `5564981009108`, com mensagem pre-preenchida e evento `whatsapp_contact_click`.
- Criado formulario publico em `/contato`, com envio via `/contato/enviar`, honeypot, validacao e evento `contact_form_submit`.
- Criado script `pnpm indexnow:submit` e etapa opcional no deploy quando `INDEXNOW_ENABLED=1`.
- Criada secao "SEO e Presenca Digital" no Portal Admin Global.

### Impactos esperados

- Melhor descoberta organica em buscadores tradicionais.
- Mais clareza semantica para experiencias de busca assistidas por IA.
- Reducao do risco de indexacao de telas privadas.
- Melhor preview de compartilhamento em redes e mensageria.
- Caminho mensuravel para contatos via WhatsApp e formulario.

### Riscos e pendencias

- Google Search Console, Bing Webmaster Tools, GA4, GTM e IndexNow dependem de chaves/validacoes externas do proprietario.
- A politica de privacidade e os termos devem ser revisados juridicamente antes de uso definitivo.
- As imagens sociais foram criadas como SVG; se algum canal nao renderizar SVG em preview, gerar PNG 1200x630.
- O formulario publica apenas captura/log operacional; integracao com CRM/e-mail deve ser configurada posteriormente.
- Conteudos comerciais evitam promessas de resultado. Estudos de caso e depoimentos devem ser publicados somente com autorizacao real.

## Relatorio tecnico

### Stack e renderizacao

- Framework: Next.js 15 App Router no frontend, NestJS no backend.
- As paginas publicas criadas sao server components/SSG quando possivel.
- Conteudo principal fica presente no HTML/DOM inicial.
- Portal autenticado permanece client-side por depender de auth, React Query e shell interno.

### Arquivos principais criados

- `apps/web/lib/public-site.ts`
- `apps/web/components/marketing/public-shell.tsx`
- `apps/web/components/marketing/content-blocks.tsx`
- `apps/web/components/marketing/whatsapp-button.tsx`
- `apps/web/components/marketing/contact-form.tsx`
- `apps/web/components/marketing/json-ld.tsx`
- `apps/web/components/marketing/analytics.tsx`
- `apps/web/app/sitemap.ts`
- `apps/web/app/robots.ts`
- `apps/web/app/llms.txt/route.ts`
- `apps/web/app/indexnow-key.txt/route.ts`
- `apps/web/app/contato/enviar/route.ts`
- `apps/web/middleware.ts`
- `scripts/indexnow-submit.mjs`
- paginas publicas em `/solucoes`, `/segmentos`, `/conteudos`, `/sobre`, `/contato`, `/seguranca`, `/implantacao`, `/suporte`, `/politica-de-privacidade`, `/termos-de-uso`.

### Arquivos principais modificados

- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/components/platform-admin/platform-admin-app.tsx`
- `apps/api/src/modules/platform-admin/platform-admin.controller.ts`
- `apps/api/src/modules/platform-admin/services/platform-admin.service.ts`
- `apps/web/Dockerfile`
- `docker-compose.droplet.yml`
- `scripts/deploy.sh`
- `.env.example`
- `.env.droplet.example`
- `.env.production.example`
- `package.json`

### Classificacao de rotas

| Grupo | Exemplos | Indexacao |
| --- | --- | --- |
| Publicas indexaveis | `/`, `/solucoes`, `/segmentos`, `/conteudos`, `/sobre`, `/contato` | Sim |
| Publicas nao prioritarias | `/indexnow-key.txt`, `/llms.txt` | Rastreaveis, nao comerciais |
| Autenticadas do portal | `/dashboard`, `/meu-dia`, `/indicators`, `/documents`, `/settings` | Nao |
| Administrativas | `/platform-admin`, `/settings/database`, `/settings/portal` | Nao |
| APIs | `/api/*`, `/contato/enviar` | Nao incluir em sitemap |
| Desenvolvimento/homologacao | `/dev`, `/staging`, `/homologacao` | Bloqueadas no robots |
| Arquivos internos | codigos, configs, docs internas, scripts | Nao servidos como paginas publicas |
| Dados de clientes | dashboards, documentos, registros, indicadores, usuarios | Protegidos por auth/tenant/permissao |

### Robots e IA

- `OAI-SearchBot`: permitido em paginas publicas, bloqueado nas rotas privadas.
- `GPTBot`: bloqueado por padrao (`Disallow: /`) ate o proprietario decidir se deseja permitir uso para treinamento.
- Essa decisao separa busca/descoberta de treinamento de modelos.
- `robots.txt` nao substitui autenticacao, tenant ou autorizacao.

### IndexNow

- Chave publica: `INDEXNOW_KEY`.
- Verificacao: `https://gestao360.org/indexnow-key.txt`.
- Envio manual/local: `pnpm indexnow:submit`.
- Deploy: `scripts/deploy.sh` executa o envio somente se `INDEXNOW_ENABLED=1`.
- Fonte das URLs: `sitemap.xml`.

### Analytics

- GA4: `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- GTM: `NEXT_PUBLIC_GTM_ID`.
- Eventos criados:
  - `whatsapp_contact_click`
  - `contact_form_submit`
- Eventos evitam gravar dados pessoais completos em dataLayer.

### WhatsApp

- Numero: `5564981009108`.
- Link: `https://wa.me/5564981009108?...`.
- Botao flutuante em paginas publicas.
- `aria-label` e `title` configurados.
- Balao contextual pode ser fechado e memoriza preferencia em `localStorage`.

## Checklist manual pos-deploy

1. Definir `NEXT_PUBLIC_SITE_URL=https://gestao360.org` no ambiente de producao.
2. Definir `NEXT_PUBLIC_WHATSAPP_NUMBER=5564981009108`.
3. Revisar e aprovar juridicamente `/politica-de-privacidade` e `/termos-de-uso`.
4. Criar propriedade no Google Search Console.
5. Validar dominio e enviar `https://gestao360.org/sitemap.xml`.
6. Criar propriedade no Bing Webmaster Tools.
7. Gerar `INDEXNOW_KEY` com `openssl rand -hex 32`.
8. Definir `INDEXNOW_ENABLED=1` e `INDEXNOW_KEY` no ambiente.
9. Validar `https://gestao360.org/indexnow-key.txt`.
10. Rodar `pnpm indexnow:submit` ou aguardar deploy com IndexNow ativo.
11. Configurar `NEXT_PUBLIC_GA_MEASUREMENT_ID` ou `NEXT_PUBLIC_GTM_ID`, se houver.
12. Testar preview de compartilhamento no WhatsApp e LinkedIn.
13. Testar formulario de contato e fluxo de retorno comercial.
14. Testar clique no WhatsApp e conferir evento no dataLayer/analytics.
15. Monitorar cobertura, Core Web Vitals, erros 404 e paginas excluidas.

## Backlog priorizado

1. Gerar imagens OG em PNG/WebP para paginas estrategicas.
2. Integrar formulario com CRM ou e-mail transacional.
3. Criar painel de leads e eventos agregados no Portal Admin Global.
4. Publicar novos artigos profundos:
   - Diferenca entre meta, indicador e iniciativa estrategica.
   - Como aplicar MASP e 5W2H no tratamento de problemas.
   - Como controlar documentos corporativos e revisoes.
   - Como digitalizar formularios e checklists operacionais.
   - Como organizar gestao estrategica com varias filiais.
5. Criar estudos de caso apenas com autorizacao de clientes.
6. Fazer pesquisa de palavras-chave e ajustar prioridades editoriais.
7. Criar sitemap index se o volume de conteudo crescer.
8. Adicionar testes E2E para sitemap, robots, WhatsApp e formulario.
9. Revisar trimestralmente conteudos, metadados e relatorios de busca.
