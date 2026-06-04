# Integração com APIs Externas — Gestão 360

Fundação para integrar o Gestão 360 com **SAP, Apdata, SE Suite e qualquer sistema externo**, nos dois
sentidos:

- **Saída (outbound)** — o Gestão 360 envia/puxa dados de um sistema externo (conectores).
- **Entrada (inbound)** — sistemas externos enviam/leem dados do Gestão 360 via **API pública** com chave.

Tudo é **isolado por empresa**. Credenciais ficam **cifradas** (AES-256-GCM) e nunca são exibidas.
Acesse em **Configurações → Integrações → APIs Externas** (`/settings/integracoes`, perfil com `settings:manage`).

## 1. Modelo
- `ExternalIntegration` — conector (provider, direção, autenticação, baseUrl, credenciais cifradas, config).
- `ExternalIntegrationLog` — histórico de testes/sincronizações.
- `InboundApiKey` — chave de API por empresa (guardamos só o hash sha256 + prefixo; o token é exibido 1x).

## 2. Entrada (API pública) — `/api/external/v1`
Autenticação por header **`X-Api-Key: <token>`**. A **empresa é sempre derivada da chave** (nunca do corpo).
Cada chave tem **escopos**: `indicators:read`, `results:read`, `results:write`. Rate limit aplicado.

| Método | Rota | Escopo | Descrição |
|---|---|---|---|
| GET | `/api/external/v1/health` | — | Valida a chave; retorna empresa/escopos. |
| GET | `/api/external/v1/indicators` | `indicators:read` | Indicadores da empresa (definição + último período). |
| POST | `/api/external/v1/results` | `results:write` | Importa realizados por `indicatorCode` + `periodRef`. |
| GET | `/api/external/v1/areas` | `org:read` | Estrutura organizacional (áreas/setores). |
| GET | `/api/external/v1/action-plans` | `actions:read` | Planos de ação (resumo). |

Escopos disponíveis: `indicators:read`, `results:read`, `results:write`, `org:read`, `actions:read`.

### Exemplos
```bash
# Health
curl -H "X-Api-Key: g360_xxx" https://SEU_HOST/api/external/v1/health

# Listar indicadores
curl -H "X-Api-Key: g360_xxx" https://SEU_HOST/api/external/v1/indicators

# Importar realizados (SAP/Apdata/etc. enviando dados para o Gestão 360)
curl -X POST https://SEU_HOST/api/external/v1/results \
  -H "X-Api-Key: g360_xxx" -H "content-type: application/json" \
  -d '{"items":[{"indicatorCode":"IND-001","periodRef":"2026-05","value":92.5}]}'
```
Resposta de `POST /results`: `{ "processed": N, "errors": [...] }`. O farol é recalculado automaticamente.
`periodRef`: `YYYY-MM` (mensal), `YYYY` (anual), etc., conforme a periodicidade do indicador.

## 3. Saída (conectores)
Cadastre um conector escolhendo o **sistema** (SAP, Apdata, SE Suite, REST genérico, Webhook), a **direção**,
a **autenticação** (API Key/Bearer/Basic/OAuth2) e a **URL base**. A sincronização é **manual/sob demanda** (menu "Sincronizar…" por conector):
- **Testar** conexão.
- **Enviar** `push:results` / `push:indicators` / `push:areas` / `push:actions`.
- **Puxar resultados** (`pull:results`) — o retorno `{ items: [{ indicatorCode, periodRef, value }] }` é gravado.

### Config avançada (JSON)
Mapeia caminhos e cabeçalhos do sistema externo:
```json
{
  "endpoints": { "test": "/health", "push:results": "/kpi/results", "pull:results": "/kpi/results" },
  "headers": { "X-Company": "001" },
  "timeoutMs": 15000
}
```
O `GenericRestConnector` é totalmente funcional. **SAP/Apdata/SE Suite** são templates que herdam o genérico
com cabeçalhos padrão de cada fornecedor — ficam operacionais ao preencher endpoints/credenciais (e podem
ser especializados conforme o contrato real de cada API).

## 4. Segurança
- Credenciais cifradas com **AES-256-GCM** (`apps/api/src/common/crypto.ts`); chave-mestra de
  `INTEGRATIONS_SECRET` (recomendado definir na Droplet) ou, na ausência, derivada do `JWT_ACCESS_SECRET`.
- Credenciais **nunca** retornam ao frontend (a API expõe só `hasCredentials`, `authType`, `baseUrl`).
- Chaves de entrada: só o **hash** é persistido; o token é mostrado **uma única vez**.
- Empresa sempre derivada da sessão (admin) ou da chave (inbound) — nunca do corpo da requisição.
- Ações administrativas e execuções são auditadas (`AuditLog` / `ExternalIntegrationLog`).

## 5. Arquivos
- API: `prisma/schema.prisma` (modelos), `common/crypto.ts`, `modules/integrations/` (connectors,
  `external-integration.{service,controller,dto}`), `modules/external-api/` (`api-key.guard`,
  `external-api.{service,controller,dto,module}`), `app.module.ts`.
- Web: `app/(app)/settings/integracoes/page.tsx`, card em `app/(app)/settings/page.tsx`.

## 6. Roadmap (próximas fases)
- Agendamento automático (cron) por conector. - OAuth2 client-credentials completo. - Mais recursos
  (estrutura/áreas, planos de ação) na API pública. - Webhooks de saída em eventos (resultado lançado, etc.).
