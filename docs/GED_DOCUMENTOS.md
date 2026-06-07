# GED - Gestao de Documentos

## Escopo entregue

O modulo `Gestao > Documentos` foi evoluido de um cadastro simples para uma base GED integrada:

- Tipos configuraveis por empresa (`document_types`) com prefixo, padrao de codigo, sequencia, validade e alertas.
- Geracao automatica de codigo por empresa/tipo, por exemplo `PRO-001`.
- Criacao de documento com revisao inicial `Rev. 00` e arquivo DOCX controlado em storage privado.
- Versionamento em `document_versions`, arquivos em `document_files` e historico de status em `document_status_history`.
- Workflow com acoes protegidas: enviar para revisao, solicitar ajustes, concluir revisao, enviar para aprovacao, aprovar, rejeitar, publicar, criar nova revisao, tornar obsoleto e arquivar.
- Publicacao cria registro de PDF oficial controlado, preservando a revisao anterior.
- Autosave/checkpoints em `document_autosave_checkpoints`.
- Comentarios, solicitacoes de ajuste, aprovacoes, logs de download/visualizacao, auditoria documental e confirmacao de leitura.
- Matriz mestra na UI, filtros, cards de vencimento e detalhe com abas.
- Isolamento por `companyId` e escopo por area via `AccessService`, mantendo o padrao dos modulos corporativos.

## Migrations

- `20260604150000_document_register`: tabela `Document` original.
- `20260605100000_document_ged_foundation`: fundacao GED com tipos, regras de codigo, templates, versoes, arquivos, workflow, auditoria, distribuicao, tags e checkpoints.

Todas as alteracoes sao aditivas. A migration nao apaga documentos existentes.

## Modelo de dados principal

- `Document`: agregado principal, com empresa, codigo, titulo, status, validade, responsavel, aprovador, area e indicador.
- `document_types`: configuracao por empresa para tipos como Procedimento, Politica, Instrucao, Registro e Documento Externo.
- `document_versions`: revisoes preservadas, com motivo, resumo, status e referencias a DOCX/PDF.
- `document_files`: metadados de arquivos DOCX, PDF, templates, evidencias e anexos. Os arquivos ficam em storage privado.
- `document_status_history`: trilha de status anterior/novo, usuario, comentario e metadados.
- `document_approvals` e `document_review_requests`: fluxo de aprovacao e ajustes.
- `document_audit_logs`: auditoria especifica do GED.
- `document_autosave_checkpoints`: checkpoints de conteudo.
- `document_read_confirmations`: confirmacao de leitura por usuario e revisao.

## Endpoints principais

Base local: `http://localhost:3333/api/documents`

- `GET /documents`: lista com filtros.
- `GET /documents/summary`: indicadores resumidos.
- `GET /documents/matrix`: matriz mestra.
- `GET /documents/:id`: detalhe com revisoes, arquivos, auditoria, comentarios e aprovacoes.
- `POST /documents`: cria documento e gera codigo/arquivo inicial.
- `PATCH /documents/:id`: atualiza metadados permitidos. Status nao muda por PATCH.
- `POST /documents/:id/submit-review`
- `POST /documents/:id/start-review`
- `POST /documents/:id/request-adjustments`
- `POST /documents/:id/complete-review`
- `POST /documents/:id/send-approval`
- `POST /documents/:id/start-approval`
- `POST /documents/:id/approve`
- `POST /documents/:id/reject`
- `POST /documents/:id/publish`
- `POST /documents/:id/new-revision`
- `POST /documents/:id/obsolete`
- `POST /documents/:id/archive`
- `POST /documents/:id/autosave`
- `POST /documents/:id/files`
- `GET /documents/:id/files/:fileId/download`
- `POST /documents/:id/comments`
- `POST /documents/:id/read-confirmations`
- `GET|POST /documents/types`
- `GET|POST /documents/templates`
- `POST /documents/jobs/expiration`
- `GET /documents/diagnostics`

## Permissoes

Permissoes existentes:

- `doc:view`
- `doc:create`
- `doc:update`
- `doc:delete`
- `doc:manage`

Permissoes granulares adicionadas ao catalogo:

- `doc:review`
- `doc:approve`
- `doc:publish`
- `doc:download_pdf`
- `doc:download_docx`
- `doc:audit`
- `doc:templates`
- `doc:types`

Os endpoints continuam usando permissoes consolidadas onde isso preserva compatibilidade. A granularidade nova esta pronta para refinar guards por rota.

## Variaveis de ambiente

- `DOCUMENT_STORAGE_PROVIDER`: `LOCAL` por padrao.
- `DOCUMENT_STORAGE_PATH`: caminho privado para arquivos, padrao `storage/documents`.
- `DOCUMENT_EDITOR_PROVIDER`: `manual` por padrao; `collabora` ativa o editor online (WOPI).
- `DOCUMENT_EDITOR_URL`: URL publica do servidor Collabora Online (ex.: `https://collabora.gestao360.org`).
- `DOCUMENT_EDITOR_WOPI_BASE`: URL publica da API (host WOPI) que o Collabora usa para ler/salvar o DOCX. Deve incluir o prefixo `/api` (ex.: `https://gestao360.org/api`).
- `DOCUMENT_EDITOR_JWT_SECRET`: segredo HMAC que assina o `access_token` WOPI. Se ausente, cai para `JWT_ACCESS_SECRET`. Gere com `openssl rand -base64 48`.
- `DOCUMENT_EDITOR_TOKEN_TTL_MS` (opcional): validade do `access_token`, padrao 10h.
- `COLLABORA_ADMIN_USER` / `COLLABORA_ADMIN_PASSWORD`: console admin do Collabora (usadas no docker-compose).

Documentos corporativos nao sao gravados em `public/` e nao recebem URL publica direta.

## Editor DOCX

`DocumentEditorService` opera em modo `ONLINE` quando `DOCUMENT_EDITOR_PROVIDER != manual` e `DOCUMENT_EDITOR_URL` + `DOCUMENT_EDITOR_WOPI_BASE` estao definidos. Sem isso, a UI mantem o modo manual:

- visualizar metadados/conteudo;
- baixar arquivo controlado;
- enviar nova versao;
- registrar substituicao e auditoria.

### Integracao Collabora Online (WOPI)

O provedor `collabora` implementa um **host WOPI** dentro da propria API:

- `POST /documents/:id/editor/open` (autenticado): garante um DOCX binario real para a revisao (gerando um `.docx` valido a partir do conteudo quando necessario), cria a sessao do editor, emite um `access_token` assinado (HMAC) e devolve a `editorUrl` do Collabora ja com o `WOPISrc`.
- O frontend abre um dialog com `<iframe>` e submete um formulario `POST` com `access_token`/`access_token_ttl` para a `editorUrl`.
- O servidor Collabora chama de volta o host WOPI (rotas `@Public`, validadas pelo token):
  - `GET /api/wopi/files/:id` — CheckFileInfo (metadados/permissoes).
  - `GET /api/wopi/files/:id/contents` — GetFile (bytes do DOCX).
  - `POST /api/wopi/files/:id/contents` — PutFile (salva a nova versao binaria + checkpoint + auditoria `EDITOR_SAVE`).
  - `POST /api/wopi/files/:id` — Lock/Unlock/RefreshLock/GetLock (edicao colaborativa).
- O corpo de `PutFile` chega como `octet-stream`; como o Nest so faz parse de JSON/urlencoded, o `WopiController` le o stream binario bruto diretamente da requisicao.
- Os DOCX binarios ficam apenas no storage (sem `contentText`); por isso o `download` controlado e binario-safe e o volume de storage e obrigatorio em producao.

### Passo a passo (droplet)

1. DNS: crie `collabora.gestao360.org` (A) apontando para o IP do droplet.
2. No `Caddyfile`, descomente o bloco `collabora.gestao360.org` somente depois do DNS estar resolvendo para o droplet.
3. `.env`: defina `DOCUMENT_EDITOR_PROVIDER=collabora`, `DOCUMENT_EDITOR_URL`, `DOCUMENT_EDITOR_WOPI_BASE`, `DOCUMENT_EDITOR_JWT_SECRET` e `COLLABORA_ADMIN_*` (ver `.env.droplet.example`).
4. Suba a stack principal: `docker compose -f docker-compose.droplet.yml up -d` (mantem API, web, Caddy e o volume `g360_storage`).
5. Suba o Collabora pelo profile dedicado: `docker compose -f docker-compose.droplet.yml --profile collabora up -d collabora`.
6. O Caddy publica o subdominio e emite TLS automatico; o Collabora roda em HTTP com `ssl.termination=true`.
7. Valide a discovery: `curl https://collabora.gestao360.org/hosting/discovery`.
8. Abra um documento em rascunho > aba Documento > "Abrir editor online".

### Dev local (opcional)

O Collabora roda em container e precisa alcancar a API do host. Use
`DOCUMENT_EDITOR_WOPI_BASE=http://host.docker.internal:3333/api`,
`DOCUMENT_EDITOR_URL=http://localhost:9980` e suba o CODE com
`--o:ssl.enable=false`. O `aliasgroup1` do Collabora deve incluir o host WOPI.

### Limitacoes

- Os locks WOPI sao mantidos em memoria (1 instancia da API). Para multiplas replicas, migrar o lock store para Redis.
- O `.docx` semeado a partir do conteudo textual e um OOXML minimo (paragrafos); a formatacao rica passa a ser produzida no proprio editor.

## Armazenamento

`DocumentStorageService` implementa provider local privado. A interface foi separada para evoluir para S3, MinIO, Azure Blob ou equivalente.

O banco armazena metadados, hash e chave controlada. Para os textos gerados nesta base local, `contentText` tambem fica registrado para facilitar download e auditoria em desenvolvimento.

## Jobs

`POST /documents/jobs/expiration` executa a rotina manual de vencimento:

- verifica documentos publicados;
- marca `NEAR_EXPIRATION` quando vencem em ate 30 dias;
- marca `EXPIRED` quando vencidos;
- registra historico e auditoria.

Em producao, este metodo deve ser acionado por BullMQ/cron, seguindo a stack ja preparada do projeto.

## Testes

Validados:

- `pnpm --filter @g360/api exec tsc --noEmit --pretty false`
- `pnpm --filter @g360/web exec tsc --noEmit`
- `pnpm --filter @g360/api test -- documents.service.spec.ts`

Cobertura focada atual:

- isolamento por empresa/area;
- filtro por status/tipo/busca;
- vencidos e proximos do vencimento;
- bloqueio cross-company;
- criacao com codigo automatico, versao e arquivo inicial;
- bloqueio de alteracao direta de status;
- sanitizacao de `id/companyId` em update.

## Checklist de homologacao

1. Cadastrar ou confirmar tipo `Procedimento` com prefixo `PRO`.
2. Criar documento de procedimento.
3. Confirmar codigo `PRO-001` na empresa.
4. Abrir detalhe e validar `Rev. 00`.
5. Editar conteudo em rascunho e salvar checkpoint.
6. Enviar para revisao.
7. Iniciar revisao.
8. Solicitar ajustes com comentario obrigatorio.
9. Reenviar para revisao.
10. Concluir revisao.
11. Enviar para aprovacao.
12. Iniciar aprovacao.
13. Aprovar.
14. Publicar.
15. Validar PDF oficial em arquivos.
16. Baixar PDF pelo endpoint controlado.
17. Consultar historico e auditoria.
18. Criar nova revisao.
19. Confirmar que a revisao anterior permanece no historico.
20. Rodar job de vencimento e validar status calculado.
21. Consultar matriz mestra.
22. Confirmar leitura.
23. Testar usuario de outra empresa/area e validar bloqueio.

## Limitacoes conhecidas

- O provider local gera conteudo controlado em formato textual com MIME de DOCX/PDF para a fundacao GED; o editor online passa a gravar DOCX binario real (OOXML) via Collabora. A geracao automatica de PDF oficial binario ainda depende de motor externo.
- O editor online (Collabora/WOPI) esta integrado e funcional quando o servidor Collabora esta configurado e alcancavel; locks ficam em memoria (1 instancia).
- Os guards ainda usam permissoes consolidadas (`doc:update`, `doc:manage`) em algumas rotas; o catalogo granular ja existe para refinamento futuro.
- A rotina de vencimento esta exposta como job manual; agendamento automatico deve ser conectado ao BullMQ/cron da infraestrutura.
