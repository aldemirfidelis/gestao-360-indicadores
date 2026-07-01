# LGPD e Privacidade — Gestão 360

Conjunto de documentos e controles de privacidade/proteção de dados. As políticas abaixo são
**MINUTAS** (versão 0.1) e **precisam de validação jurídica e aprovação da Diretoria** antes de
publicação/uso oficial. Elaboradas em 2026-07-01 a partir da autoavaliação do questionário de
segurança/LGPD.

## Documentos

| Documento | Arquivo | Status |
|---|---|---|
| Política Geral de Segurança da Informação e Privacidade | [politica-seguranca-informacao-privacidade.md](./politica-seguranca-informacao-privacidade.md) | Minuta 0.1 |
| Política Geral de Proteção de Dados Pessoais | [politica-protecao-dados-pessoais.md](./politica-protecao-dados-pessoais.md) | Minuta 0.1 |
| Plano de Resposta a Incidentes (SI e dados pessoais) | [plano-resposta-incidentes.md](./plano-resposta-incidentes.md) | Minuta 0.1 |
| Código de Conduta e Ética (com privacidade) | [codigo-conduta-etica-privacidade.md](./codigo-conduta-etica-privacidade.md) | Minuta 0.1 |
| Termo de Confidencialidade (NDA) — Colaboradores | [modelo-acordo-confidencialidade.md](./modelo-acordo-confidencialidade.md) | Modelo 0.1 |
| Aditivo Contratual Trabalhista — LGPD | [modelo-aditivo-contratual-lgpd.md](./modelo-aditivo-contratual-lgpd.md) | Modelo 0.1 |

## Autoavaliação — respostas ao questionário

> **Atualizado em 2026-07-01**, após o deploy do módulo de privacidade (`/privacidade`:
> RoPA, suboperadores e incidentes) em produção — commit `9279635`, tabelas
> `DataProcessingRecord`, `Subprocessor` e `DataIncident` confirmadas no banco gerenciado
> (`prisma migrate status` = up to date). A versão anterior desta tabela refletia o estado
> antes do deploy e ficou defasada.

Legenda: ✅ **Sim** — atendido/comprovado pela plataforma-infra · 🟡 **Sim** — documento ou
ferramenta existe, mas pendente de formalização (assinatura/aprovação/nomeação) ·
❌ **Não** — não atendido (ver observação: pode estar mitigado ou ser organizacional).

| # | Item | Resp. | Observação |
|---|---|---|---|
| 1 | Registro de operações / Data Mapping (RoPA) | ✅ Sim | Módulo RoPA no ar (`/privacidade`); tabela `DataProcessingRecord` em produção. |
| 2 | Política Geral de SI e Privacidade | 🟡 Sim | Minuta v0.1 redigida — pendente validação jurídica + aprovação da Diretoria. |
| 3 | Política Geral de Proteção de Dados | 🟡 Sim | Minuta v0.1 redigida — pendente aprovação. |
| 4 | Plano de Resposta a Incidentes | 🟡 Sim | Minuta v0.1 + módulo de registro de incidentes no ar (`DataIncident`); pendente aprovar/testar o plano. |
| 5 | Treinamento e Conscientização | ❌ Não | Organizacional (RH) — não iniciado. |
| 6 | Código de Conduta e Ética c/ privacidade | 🟡 Sim | Minuta v0.1 redigida — pendente aprovação. |
| 7 | DPO/Encarregado nomeado | ❌ Não | Seção do DPO publicada em `/lgpd`, mas falta nomear a pessoa + e-mail próprio (contato@gestao360.org não provisionado). |
| 8 | Acordo de Confidencialidade | 🟡 Sim | Modelo (NDA) redigido — pendente assinatura com o time. |
| 9 | Aditivo contratual LGPD | 🟡 Sim | Modelo redigido — pendente assinatura. |
| 10 | Transferência Internacional de Dados | ✅ Sim | DigitalOcean fora do Brasil. |
| 11 | Países de transferência | — | DigitalOcean (confirmar datacenter; provável EUA). |
| 12 | Contrato/cláusulas (DPA) de Transf. Internacional | ❌ Não | Formalizar o DPA do provedor. |
| 13 | Suboperadores na cadeia | ✅ Sim | Registro no ar (`Subprocessor`); DigitalOcean, provedor SMTP, Google Gemini. |
| 14 | Quantidade de suboperadores | 3 | DigitalOcean, SMTP, Google Gemini (confirmar/enumerar). |
| 15 | Medidas técnicas e administrativas | ✅ Sim | Detalhadas na Política de SI e na seção abaixo. |
| 16 | Antivírus nos Computadores | ❌ Não | Estações de trabalho — organizacional. |
| 17 | Antivírus nos Servidores/Redes | ❌ Não | Servidor Linux: mitigado por hardening + UFW + fail2ban (sem AV tradicional). |
| 18 | Firewall de rede | ✅ Sim | UFW ativo (deny incoming, só 22/80/443) + firewall de nuvem. |
| 19 | Controle de arquivos enviados | ❌ Não (parcial) | Validação de upload existe; sem antimalware dedicado. |
| 20 | Acesso remoto via VPN | ❌ Não | SSH exclusivamente por chave + TLS (sem VPN). |
| 21 | Backup e Contingência | ✅ Sim | Backup lógico + PITR do PostgreSQL gerenciado (backup diário automático). |
| 22 | Dados em Nuvem | ✅ Sim | DigitalOcean. |
| 23 | Criptografia em trânsito | ✅ Sim | TLS/HTTPS + HSTS + sslmode=require. |
| 24 | Criptografia em repouso | ✅ Sim | Banco gerenciado + segredos AES-256-GCM. |
| 25 | Data Loss Prevention (DLP) | ❌ Não | Não há solução dedicada. |
| 26 | Active Directory (AD) | ❌ Não | Autenticação própria (JWT + RBAC). |
| 27 | Controle de autorização de acesso | ✅ Sim | RBAC granular + multitenancy por empresa. |
| 28 | Anti-Ransomware | ❌ Não | Mitigado por backup + hardening. |
| 29 | Bloqueio de portas USB | ❌ Não | N/A ao backend em nuvem; organizacional p/ estações. |
| 30 | Certificado SSL nos e-mails | ❌ Não (parcial) | Depende da config SMTP (TLS/STARTTLS); caixa própria ainda não provisionada. |
| 31 | Norma de SI em meios eletrônicos | 🟡 Sim | Coberta pela Política de SI (minuta, pendente aprovação). |
| 32 | Controle de logs | ✅ Sim | Logging estruturado (pino) + AuditLog + redação de dados sensíveis. |

## Controles técnicos comprovados (evidências no código/infra)

- Criptografia em trânsito: proxy Caddy (TLS), HSTS, `sslmode=require`.
- Criptografia de segredos: `apps/api/src/common/crypto.ts` (AES-256-GCM).
- Redação de dados sensíveis em log: `apps/api/src/common/logging/redact.ts`.
- Backup: `apps/api/src/modules/database-admin/services/backup.service.ts` + PITR do provedor.
- Autorização: RBAC/guards em `apps/api/src/common/guards` e módulos de acesso.
- Auditoria/logs: modelos `AuditLog`, `DocumentAuditLog`, `DocumentViewLog`, `DocumentDownloadLog`.
- Hardening de perímetro: ver `docs/SEGURANCA.md` e `docs/SECURITY-AUDIT.md` (UFW/SSH/fail2ban).
- **Módulo de privacidade** (`/privacidade`): RoPA (`DataProcessingRecord`), suboperadores
  (`Subprocessor`) e incidentes de dados (`DataIncident`) — CRUD por empresa, restrito a
  COMPANY_ADMIN/SUPER_ADMIN. **No ar em produção** (commit `9279635`).
- Seção do **Encarregado (DPO)** publicada na página pública `/lgpd`.

## Features de plataforma — entregues

- ✅ **RoPA / Data Mapping** (item 1) — registro das operações de tratamento.
- ✅ **Registro de suboperadores** (itens 13-14).
- ✅ **Registro de incidentes de dados pessoais** (item 4) — base para fluxo de comunicação à ANPD/titulares.
- ✅ **Seção do DPO** publicada em `/lgpd` (item 7 — falta só a nomeação formal + e-mail próprio).

## Pendências (para virar "Sim" pleno)

**Formalização documental** (itens 2, 3, 4, 6, 8, 9, 31) — os documentos já existem neste
diretório; falta validação jurídica + aprovação da Diretoria (políticas/plano) e assinatura
(NDA/aditivo) com os colaboradores.

**Ações organizacionais** (itens 5, 7, 11-12) — nomear formalmente o DPO e provisionar o
e-mail contato@gestao360.org; programa de treinamento (RH); formalizar o DPA com o provedor e
confirmar a região/país do datacenter.

**Controles técnicos ainda "Não"** (itens 17, 19, 20, 25, 28, 30) — antimalware em
servidor/uploads, VPN, DLP, anti-ransomware dedicado e TLS confirmado no e-mail; vários são
**mitigados** por controles equivalentes (hardening, backup+PITR, TLS) e podem ser justificados
na coluna de notas do questionário.
