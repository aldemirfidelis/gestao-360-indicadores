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

Legenda: ✅ atendido pela plataforma/infra · ❌ não · ⚠️ organizacional (depende da empresa) ·
🔧 feature planejada na plataforma · 📄 minuta redigida neste diretório.

| # | Item | Resp. | Observação |
|---|---|---|---|
| 1 | Registro de operações / Data Mapping (RoPA) | ❌ 🔧 | Há logs de auditoria; falta RoPA formal. |
| 2 | Política Geral de SI e Privacidade | ❌ 📄 | Minuta redigida. |
| 3 | Política Geral de Proteção de Dados | ❌ 📄 | Minuta redigida. |
| 4 | Plano de Resposta a Incidentes | ❌ 📄 🔧 | Minuta redigida; registro na plataforma planejado. |
| 5 | Treinamento e Conscientização | ❌ ⚠️ | RH/organizacional. |
| 6 | Código de Conduta e Ética c/ privacidade | ❌ 📄 | Minuta redigida. |
| 7 | DPO/Encarregado nomeado | ❌ ⚠️ 🔧 | Nomeação organizacional; publicar contato em /lgpd. |
| 8 | Acordo de Confidencialidade | ❌ 📄 | Modelo redigido. |
| 9 | Aditivo contratual LGPD | ❌ 📄 | Modelo redigido. |
| 10 | Transferência Internacional de Dados | ✅ | Sim — DigitalOcean fora do Brasil. |
| 11 | Países de transferência | — | DigitalOcean (confirmar região; provável EUA). |
| 12 | Contrato/cláusulas (DPA) de Transf. Internacional | ❌ ⚠️ | Formalizar o DPA do provedor. |
| 13 | Suboperadores na cadeia | ✅ 🔧 | DigitalOcean, SMTP, Google Gemini (registro planejado). |
| 14 | Quantidade de suboperadores | 3 | Confirmar e enumerar. |
| 15 | Medidas técnicas e administrativas | ✅ | Detalhadas na Política de SI. |
| 16 | Antivírus nos Computadores | ⚠️ | Estações — organizacional. |
| 17 | Antivírus nos Servidores/Redes | ❌ | Linux: hardening + UFW + fail2ban. |
| 18 | Firewall de rede | ✅ | UFW verificado + firewall de nuvem. |
| 19 | Controle de arquivos enviados | ❌ (parcial) | Validação de upload; sem antimalware. |
| 20 | Acesso remoto via VPN | ❌ | SSH por chave + TLS. |
| 21 | Backup e Contingência | ✅ | Backup lógico + PITR do banco gerenciado. |
| 22 | Dados em Nuvem | ✅ | DigitalOcean. |
| 23 | Criptografia em trânsito | ✅ | TLS/HTTPS + HSTS + sslmode=require. |
| 24 | Criptografia em repouso | ✅ | Banco gerenciado + segredos AES-256-GCM. |
| 25 | Data Loss Prevention (DLP) | ❌ | Não há solução dedicada. |
| 26 | Active Directory (AD) | ❌ | Auth própria (JWT + RBAC). |
| 27 | Controle de autorização de acesso | ✅ | RBAC granular + multitenancy. |
| 28 | Anti-Ransomware | ❌ | Mitigado por backup + hardening. |
| 29 | Bloqueio de portas USB | ❌ ⚠️ | N/A ao backend em nuvem. |
| 30 | Certificado SSL nos e-mails | ⚠️ | Depende da config SMTP (TLS/STARTTLS). |
| 31 | Norma de SI em meios eletrônicos | ❌ 📄 | Coberta pela Política de SI. |
| 32 | Controle de logs | ✅ | Logging estruturado + AuditLog + redação de dados sensíveis. |

## Controles técnicos comprovados (evidências no código/infra)

- Criptografia em trânsito: proxy Caddy (TLS), HSTS, `sslmode=require`.
- Criptografia de segredos: `apps/api/src/common/crypto.ts` (AES-256-GCM).
- Redação de dados sensíveis em log: `apps/api/src/common/logging/redact.ts`.
- Backup: `apps/api/src/modules/database-admin/services/backup.service.ts` + PITR do provedor.
- Autorização: RBAC/guards em `apps/api/src/common/guards` e módulos de acesso.
- Auditoria/logs: modelos `AuditLog`, `DocumentAuditLog`, `DocumentViewLog`, `DocumentDownloadLog`.
- Hardening de perímetro: ver `docs/SEGURANCA.md` e `docs/SECURITY-AUDIT.md` (UFW/SSH/fail2ban).

## Próximas features de plataforma (planejadas)

- **RoPA / Data Mapping** (item 1) — registro das operações de tratamento.
- **Registro de suboperadores** (itens 13-14) e **publicação do contato do DPO** (item 7).
- **Registro de incidentes de dados pessoais** (item 4) — fluxo e comunicação à ANPD/titulares.

> As features acima exigem novos modelos de banco (migração Prisma). As migrações **não** são
> aplicadas em produção sem autorização explícita.
