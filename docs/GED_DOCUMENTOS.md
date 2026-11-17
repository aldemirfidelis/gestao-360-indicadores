# Documentos — GED do Gestão 360

Guia da implementação de 16/11/2026, publicada na versão `0.1.0+49eab3a6`. O registro do deploy está na memória operacional.

## Escopo

O menu lateral **Documentos** abre o acervo em `/documents`. O módulo funciona independentemente de Treinamento: não importa seus serviços, não matricula pessoas, não cria cursos e não liga publicação ou leitura a treinamento.

Inclui acervo com busca e filtros, matriz mestra, caixa de pendências, tipos e modelos, editor visual, importação/exportação Word, PDF oficial, fluxo de revisão/aprovação assinado, distribuição com leitura obrigatória, revisões, pedidos de alteração, vínculos, documentos externos, temporalidade e auditoria. Todos os acessos usam a empresa autenticada e as regras de área da plataforma.

A empresa precisa ter Documentos liberado no plano ou por exceção no Portal Admin, e o usuário precisa das permissões documentais. O módulo pertence a Qualidade e Compliance nos planos correspondentes; a reativação respeita os bloqueios existentes de empresas.

Os perfis de sistema de todas as empresas recebem as permissões documentais padrão a cada boot da API (reconciliação aditiva, a mesma da tela de Usuários; perfis personalizados e concessões individuais não mudam; `COMPANY_PROFILES_BOOTSTRAP_DISABLED=1` desliga). A demonstração pública apresenta Documentos só para consulta: o perfil `DEMO_PUBLIC` tem `doc:view`, `doc:audit`, `doc:download_pdf` e `doc:download_docx` (migration `20261117120000_demo_documents_access`), a escrita continua bloqueada e, no GED, o visitante é leitor comum, sem Configurações, controle de acesso ou documentos restritos.

Os tipos padrão são Procedimento, POP, Instrução de Trabalho, Norma Interna, Política, Manual, Formulário, Registro e Documento Externo. A reconciliação cria apenas tipos ausentes por sigla, preservando os tipos personalizados e as exclusões da empresa. A numeração é reservada por empresa/tipo, por exemplo `POP-001`, com revisão inicial `Rev. 00`.

## Editor sem licença paga

O padrão para novos documentos é **Editor visual**, baseado no núcleo aberto do **Tiptap 3.32.2 (MIT)**. Não exige Collabora, Microsoft 365 nem outro servidor de documentos. Oferece títulos, negrito/itálico/sublinhado, listas, tabelas, links e imagens PNG/JPEG embutidas. O conteúdo fica como JSON estruturado em `Document.contentJson`.

O salvamento automático ocorre após dois segundos sem digitar. **Salvar agora**, trocar de aba ou trocar o formato aguardam a fila de gravações, inclusive uma edição feita enquanto outra gravação está em andamento. Uma falha de salvamento mantém o conteúdo pendente e impede a troca de aba. Fechar/recarregar a janela com alterações pendentes dispara o aviso do navegador; o salvamento na saída é apenas uma tentativa adicional, sem garantia de entrega após o fechamento da janela.

Há três formatos principais:

| Formato | Uso | Publicação |
| --- | --- | --- |
| Editor visual (`STRUCTURED`) | Conteúdo escrito no navegador; importa texto e tabelas de DOCX | PDF gerado pelo próprio GED |
| Word (`DOCX`) | Arquivo editável por download/envio; Word instalado ou editor online opcionais | Conversor configurado; sem conversor, PDF do texto extraído, com aviso |
| PDF pronto (`FILE`) | PDF enviado como conteúdo principal | PDF original carimbado pelo GED |

A troca de formato é permitida em elaboração/ajustes. Word para editor visual pode perder formatação específica do arquivo. PDF pronto é um conteúdo próprio, enviado em **Conteúdo**; anexos comuns em PDF não substituem o PDF principal. O limite de upload e de JSON estruturado é 20 MB por operação. DOCX com macros é rejeitado.

As alternativas online de edição de Word permanecem opcionais, com WOPI/WebDAV autenticados por token temporário. `DOCUMENT_EDITOR_PROVIDER=manual` significa apenas que o editor **online de DOCX** não está configurado; o editor visual continua disponível.

Referências: [Tiptap e núcleo aberto](https://tiptap.dev/open-source-to-platform), [repositório/licença MIT](https://github.com/ueberdosis/tiptap). Collabora CODE é uma edição de desenvolvimento/teste; [o fornecedor não a recomenda para produção empresarial](https://www.collaboraonline.com/code/). ONLYOFFICE Community usa AGPL e tem condições/limites próprios ([FAQ oficial](https://helpcenter.onlyoffice.com/docs/faq/docs-community.aspx)). Nenhum desses serviços é requisito do fluxo padrão entregue.

## Operação do documento

1. Em **Novo documento**, escolha tipo/formato e origem: modelo, rascunho do processo ou documento em branco.
2. Informe título, área, responsável e validade. Defina revisores/aprovadores e, se necessário, o público de leitura obrigatória.
3. Edite em **Conteúdo**. O POP/IT mostra um checklist de seções obrigatórias. Confira a prévia em PDF.
4. Em **Fluxo**, escolha modo sequencial ou paralelo e prazos. Envie para análise. Revisões posteriores à inicial exigem um resumo do que mudou.
5. Cada participante designado confere a revisão e confirma sua decisão com a própria senha. Revisor aprova a revisão ou pede ajustes; aprovador aprova, pede ajustes ou reprova. Ajustes/reprovação exigem comentário.
6. Após a última aprovação, publique com senha ou use a opção de publicar junto da aprovação final. Também é possível agendar a entrada em vigor.
7. O público recebe a leitura obrigatória da revisão vigente. No modo leitura (`/documents/:id/leitor`), cada pessoa confirma sua leitura.
8. Para mudar conteúdo vigente, abra uma nova revisão. A anterior e seu PDF oficial permanecem preservados, até eventual descarte por temporalidade.

O elaborador (responsável ou, na falta dele, criador) não pode revisar/aprovar a própria revisão. A mesma pessoa não ocupa os papéis de revisor e aprovador. A etapa sequencial seguinte só fica ativa após a anterior; no paralelo, todos os participantes da fase podem decidir. Participantes não mudam durante análise, salvo delegação da etapa com justificativa ou cancelamento do envio.

O envio congela conteúdo, texto e hash em `document_versions`. Conteúdo aprovado/publicado fica bloqueado para edição. Alterações de conteúdo/estado e decisões usam bloqueio transacional por documento: aprovações simultâneas enxergam as decisões já confirmadas, duplo clique não assina duas vezes e uma operação calculada antes de uma mudança é rejeitada com conflito.

## Assinaturas e PDF

As decisões registram usuário, etapa/papel, data/hora, IP, agente do navegador, hash do conteúdo e assinatura HMAC. A senha é conferida com bcrypt e não é gravada no registro da decisão. Cinco tentativas erradas bloqueiam temporariamente a assinatura por dez minutos. O bloqueio de tentativas é local ao processo da API.

Este mecanismo é uma **assinatura eletrônica interna com reautenticação**, não uma assinatura com certificado ICP-Brasil. A implantação deve manter estável o segredo de assinatura. O código curto exibido no PDF é uma referência ao registro; não é um serviço público de validação de certificado.

O PDF é um arquivo real, gerado por `pdf-lib 1.17.1` e QR Code por `qrcode 1.5.4`. Inclui identificação, revisão, paginação, controle de vigência, QR para o modo leitura e registro das assinaturas. O QR exige autenticação e respeita o acesso ao documento. Cópias baixadas recebem marca d'água apropriada; o PDF oficial armazenado permanece preservado.

No editor visual, o PDF usa o layout próprio do GED, com títulos, parágrafos, listas, tabelas e imagens. Não pretende reproduzir paginação arbitrária do Microsoft Word. Word com conversor disponível gera PDF convertido; sem ele, a publicação usa o texto extraído com aviso explícito. PDF pronto recebe o carimbo de controle e a página de assinaturas.

Uma falha de geração do PDF mantém a revisão aprovada, sem assinatura de publicação ou mudança para vigente. O usuário pode corrigir o problema e tentar publicar novamente.

## Armazenamento e migração

**O padrão é o próprio Postgres do Gestão 360.** `document_files` guarda metadados e `document_blobs` guarda os bytes em `BYTEA`. As chaves de arquivo começam com `db:`; PDF, DOCX e anexos novos entram no backup normal do banco. Imagens do editor fazem parte do JSON do conteúdo.

`DOCUMENT_STORAGE_PROVIDER=LOCAL` ainda permite gravação em disco. A leitura reconhece chaves antigas de disco mesmo com o padrão DATABASE. Arquivos existentes não são copiados automaticamente: o volume legado precisa continuar acessível e incluído nos backups enquanto houver referências. Não há migração automática para S3 nesta implementação.

Migrations relevantes:

- `20260604150000_document_register`: cadastro original.
- `20260605100000_document_ged_foundation`: tipos, versões, arquivos, fluxo, auditoria e distribuição.
- `20261116200000_documents_modernization`: formatos/JSON/texto de busca, vínculo ao tipo, assinaturas, prazos/lembretes, blobs e pedidos de alteração, com dois índices GIN de busca.

A nova migration é aditiva, associa documentos existentes aos tipos por prefixo/categoria e identifica documentos com DOCX binário. Inicializa o texto de busca dos documentos legados. Não apaga documentos nem arquivos. Não basta trocar apenas a Web: a API precisa do schema atualizado e do cliente Prisma gerado.

Principais tabelas:

| Tabela | Conteúdo |
| --- | --- |
| `Document` | Cadastro, formato, JSON atual, texto e índice de busca, estado e vigência |
| `document_types`, `document_templates` | Tipos/código/modelos por empresa |
| `document_versions`, `document_files`, `document_blobs` | Revisões, arquivos e bytes |
| `document_workflows`, `document_workflow_steps` | Participantes/modo e etapas da revisão |
| `document_approvals`, `document_review_requests` | Decisões assinadas e pedidos de ajustes |
| `document_read_confirmations`, `document_distributions` | Leituras e público de distribuição |
| `document_change_requests`, `document_edit_requests` | Pedidos de alteração e liberações de edição |
| `document_audit_logs`, `document_status_history`, `document_autosave_checkpoints` | Auditoria, transições e recuperação de conteúdo |

## Busca, acesso e pendências

A busca consulta código, título, descrição, tags e texto do conteúdo. Aceita termos com/sem acento, prefixos e flexões em português; mostra um trecho do conteúdo. O texto pesquisável é recalculado após edição, troca de formato e upload principal. PDFs enviados são pesquisados pelos metadados/texto cadastrado: **não há OCR nem extração do corpo do PDF anexado**. A busca atual limita os candidatos de relevância a 500 documentos por termo.

O acervo e os totais são filtrados por empresa e acesso. Documentos internos seguem o acesso por área. As proteções de acesso restrito/confidencial permanecem disponíveis para compatibilidade e não são necessárias para usar o fluxo padrão. Documentos confidenciais são excluídos do contexto da IA.

O gestor (`doc:manage`) administra configuração, grupos e temporalidade. Criar/enviar exige permissões documentais; editar conteúdo exige responsabilidade/liberação; decidir exige uma etapa ativa designada. Exportar o Word editável é restrito a quem trabalha no documento. Leitores recebem o PDF e o modo leitura.

A **Caixa do GED** e o **Meu Dia** incluem etapas ativas, leituras pendentes, ajustes, publicação, vencimentos, pedidos de alteração e pedidos de edição. A leitura obrigatória pode ser distribuída por pessoa, grupo ou área com descendentes, com prazo e percentual de adesão. Aceitar um pedido de alteração pode abrir nova revisão; sua implementação é vinculada à revisão publicada.

Vínculos de processo/atividade, documentos relacionados e referências de reunião mensal compõem a análise de impacto. Documentos externos registram emissor, número, fonte, datas e renovação. Os recursos de IA para resumo, checklist e rascunho usam o provedor já configurado na plataforma e têm saída determinística quando indisponível; o usuário deve revisar o texto antes de enviar para aprovação.

## Temporalidade e rotinas

As regras por tipo/empresa definem prazo de guarda e destinação. Tornar obsoleto/arquivar calcula a retenção. **O descarte é manual**, restrito ao gestor, exige justificativa, documento encerrado e prazo de guarda já vencido. Não existe exclusão automática de arquivos ao vencer.

O descarte remove os blobs, o texto das versões, arquivos legados textuais, JSON atual, índice de busca e conteúdo dos checkpoints; preserva cadastro e auditoria do ato. Para blobs no banco, remoção e registro acontecem na mesma transação. Arquivos legados em disco são retirados após a confirmação no banco. Backups anteriores seguem sua política própria e não são reescritos pelo descarte.

`FocusMaintenanceScheduler` chama a rotina do GED sem depender de Redis. Por padrão roda a cada hora (mínimo configurável de cinco minutos): vencimentos, publicação agendada e reindexação faltante. Uma vez por dia/processo/empresa também recalcula distribuição e envia lembretes de etapas/leituras. Pessoas novas na área entram no recálculo diário. Em múltiplas réplicas, coordenar a execução para evitar notificações duplicadas.

`MAINTENANCE_JOBS_ENABLED=false` desliga a rotina automática. Os endpoints manuais abaixo permitem conferir uma empresa. O job não executa descarte por temporalidade.

## Configuração

Exemplo mínimo, sem servidor Word online:

```dotenv
DOCUMENT_STORAGE_PROVIDER=DATABASE
DOCUMENT_STORAGE_PATH=storage/documents
DOCUMENT_EDITOR_PROVIDER=manual
DOCUMENT_SIGNATURE_SECRET=<segredo persistente forte>
# Fallback de assinatura: JWT_ACCESS_SECRET, quando o segredo específico não está definido.
# DOCUMENT_CONTENT_BODY_LIMIT=25mb
```

A rota de conteúdo aceita corpo de 25 MB para acomodar imagens embutidas; a validação do conteúdo continua em 20 MB. As demais rotas mantêm o limite geral da API. Não coloque segredos nos exemplos versionados.

Para conversão fiel opcional de DOCX, configure `DOCUMENT_CONVERTER_URL`. A integração opcional de editor online usa `DOCUMENT_EDITOR_URL`, `DOCUMENT_EDITOR_WOPI_BASE`, `DOCUMENT_EDITOR_JWT_SECRET` e provedor correspondente. O perfil do Compose existente é `documents`. Não é preciso habilitá-lo para o editor visual ou PDF pronto. Word instalado também depende da configuração pública de WebDAV e do software do usuário.

## API principal

Prefixo padrão `/api`. As rotas exigem autenticação e autorização; exceções técnicas WOPI/WebDAV usam token próprio temporário. As rotas fixas do `DocumentFeaturesController` são registradas antes de `GET /documents/:id`.

| Método / rota | Operação |
| --- | --- |
| `GET /documents/search`, `/documents/overview`, `/documents/inbox` | Acervo, totais e caixa de pendências |
| `GET /documents/matrix`, `/documents/options` | Matriz e opções de cadastro |
| `POST /documents`, `GET/PATCH/DELETE /documents/:id` | Cadastro, detalhe, metadados e exclusão lógica |
| `PUT /documents/:id/content` | Salvar JSON do editor |
| `POST /documents/:id/content/format` | Trocar formato principal |
| `POST /documents/import/docx-html` | Importar DOCX no editor (multipart, campo `file`) |
| `POST /documents/:id/files/upload` | Upload com finalidade, inclusive MAIN_DOCX e MAIN_PDF |
| `GET /documents/:id/preview-pdf`, `/documents/:id/official-pdf` | Prévia e PDF oficial protegido |
| `GET /documents/:id/export/docx`, `/documents/:id/reader` | Exportação e conteúdo de leitura |
| `GET /documents/:id/workflow`, `PUT /documents/:id/workflow/participants` | Estado e participantes |
| `POST /documents/:id/workflow/{submit,decide,delegate,cancel}` | Envio, decisão assinada, delegação e cancelamento |
| `POST /documents/:id/publish`, `/documents/:id/unschedule` | Publicar/agendar e cancelar agendamento |
| `POST /documents/:id/new-revision`, `GET /documents/:id/compare` | Nova revisão e comparação |
| `GET/PUT /documents/:id/distribution`, `POST /documents/:id/read` | Público, adesão e confirmação |
| `GET/PUT /documents/:id/access` | Autorizações específicas |
| `GET/POST /documents/:id/relations`, `GET /documents/:id/impact` | Relações e impacto |
| `GET/POST /documents/:id/change-requests` | Pedidos de alteração |
| `POST /documents/change-requests/:requestId/decide` | Avaliar pedido de alteração |
| `PUT /documents/:id/external` | Dados do documento externo |
| `GET /documents/retention`, `POST/PATCH /documents/retention-rules[/:ruleId]` | Temporalidade |
| `POST /documents/:id/dispose` | Descarte justificado após o prazo |
| `POST /documents/:id/ai/{summary,check}`, `/documents/ai/draft-from-process` | Apoio de IA |
| `POST /documents/jobs/{maintenance,reindex}` | Rotinas manuais por empresa |

Os endpoints antigos de revisão/aprovação foram encaminhados ao novo fluxo assinado. Não permitem contornar participantes, senha ou segregação de funções. `start-review/start-approval` apenas retornam o detalhe atual.

## Validação e publicação

Use `pnpm.cmd` nesta máquina Windows; o `pnpm.ps1` é bloqueado pela política do PowerShell. Os comandos padrão em Linux continuam `pnpm`.

O ensaio `scripts/check-documents.cjs` requer a API compilada em `apps/api/dist/src`, banco **descartável** `g360_documents_review` em `localhost` e `DOCUMENTS_REVIEW_ISOLATED=1`. O script recusa outro host/nome de banco, cria somente dados fictícios e usa o armazenamento DATABASE padrão. Não execute contra a base do produto.

```powershell
$env:DATABASE_URL='postgresql://<usuario-teste>:<senha-teste>@localhost:<porta>/g360_documents_review?schema=public'
$env:DIRECT_URL=$env:DATABASE_URL
pnpm.cmd --filter @g360/api exec prisma migrate deploy
pnpm.cmd --filter @g360/shared build
pnpm.cmd --filter @g360/api exec tsc
$env:DOCUMENTS_REVIEW_ISOLATED='1'
node scripts/check-documents.cjs
```

A publicação deve seguir `docs/CODEX_MEMORIA_OPERACIONAL.md`: apresentar o resultado ao usuário e receber OK, preservar alterações alheias, conferir Postgres do servidor, criar/verificar backup, build de API/Web/shared, aplicar a migration aditiva e testar os fluxos autenticados. Não usar `db push`, reset ou seeds gerais em produção. Conferir explicitamente `DOCUMENT_STORAGE_PROVIDER=DATABASE` no ambiente publicado, pois um valor LOCAL preexistente continua valendo. Manter volume legado enquanto houver arquivos locais. Para retorno de código, manter as colunas/tabelas novas até um plano de recuperação validado; não remover blobs para reverter a interface.


### Evidências desta revisão

- API: suíte completa com 134 arquivos e 1.018 testes aprovada; GED/Meu Dia com 82 testes e revalidação final das 14 decisões/assinaturas aprovados.
- Web: 116 testes; shared: 51 testes; compilação de API e tipos da Web aprovados.
- Lint dos 54 arquivos alterados de API/Web: zero erros e zero avisos.
- Migração do zero em Postgres 17.5 descartável: 158 migrations aplicadas. Integração: 14 cenários aprovados, incluindo concorrência, falha de PDF, isolamento e descarte.
- Build focado da Web: 94 páginas; Chromium no bundle com API/Postgres sintéticos: nove cenários aprovados em desktop/celular, sem erros JavaScript. Confirmados criação pelo assistente, salvamento com falha/repetição, espera ao trocar de aba, revisão/aprovação, publicação/download de PDF, leitura obrigatória móvel e busca.
- O ensaio Windows usa uma cópia com junction e `next start`. Após a autorização, API e Web foram compiladas em Linux/Docker, incluindo o standalone da Web e 366 arquivos no pacote da API. Os 14 cenários passaram novamente na imagem final da API, com Postgres 17.11 isolado em tmpfs e dados fictícios.
- Publicação concluída com backup validado e uma migration aplicada. API, Web e Postgres saudáveis; 17 verificações do GED e 77 dos dados anteriores da Pacto aprovadas. O perfil Admin da Pacto recebeu as 13 permissões documentais pelo fluxo padrão de reconciliação aditiva dos perfis da aplicação.
- Chromium nos assets publicados: acervo e assistente completos em 1440 e 390 pixels, quatro cenários aprovados, sem erros JavaScript. Todas as respostas de dados desse ensaio foram sintéticas e nenhuma escrita foi enviada à produção.
- Evidências locais em `test-results/documents-resume/` e `test-results/documents-release/` (ignorados no Git); registros e backup de publicação em `db-backups/pre-ged-20261117/` no servidor. Serviços temporários encerrados.
