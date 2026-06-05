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
- `DOCUMENT_EDITOR_PROVIDER`: `manual` por padrao. Exemplos futuros: `onlyoffice`, `collabora`.
- `DOCUMENT_EDITOR_URL`: URL do provedor online, quando configurado.

Documentos corporativos nao sao gravados em `public/` e nao recebem URL publica direta.

## Editor DOCX

A camada `DocumentEditorService` retorna modo `ONLINE` somente quando `DOCUMENT_EDITOR_PROVIDER` e `DOCUMENT_EDITOR_URL` estao configurados. Sem isso, a UI opera em modo manual:

- visualizar metadados/conteudo;
- baixar arquivo controlado;
- enviar nova versao;
- registrar substituicao e auditoria.

Nao foi afirmada integracao funcional com ONLYOFFICE, Collabora ou Microsoft Office Web porque nenhum servidor externo foi configurado/testado nesta entrega.

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

- O provider local gera conteudo controlado em formato textual com MIME de DOCX/PDF para a fundacao GED; conversao binaria DOCX/PDF real depende de integrar um motor externo ou biblioteca especifica.
- O editor online esta desacoplado, mas nao integrado a um servidor externo nesta entrega.
- Os guards ainda usam permissoes consolidadas (`doc:update`, `doc:manage`) em algumas rotas; o catalogo granular ja existe para refinamento futuro.
- A rotina de vencimento esta exposta como job manual; agendamento automatico deve ser conectado ao BullMQ/cron da infraestrutura.
