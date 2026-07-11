# Plano de Implementação — Módulos "Serviço Pessoal" e "Suprimentos (Compras & Estoque)"

> Criado em 2026-07-09. Princípio norteador: **reuso máximo da plataforma** — nenhum
> CRUD/tela paralelo a recurso nativo. Tudo que já existe (colaboradores, organograma,
> GED, Meu Dia, notificações, importador, QR, auditoria, RBAC, planos) é a base.

---

## Parte A — Módulo Serviço Pessoal (Departamento Pessoal)

### A.1 Benchmark de mercado (lógicas copiadas)

| Ferramenta | O que copiamos |
|---|---|
| **Sólides / Convenia** | Admissão digital: checklist de documentos, coleta pelo próprio colaborador via link, conferência do DP antes de efetivar |
| **Pontomais / Ahgora / Tangerino** | Ponto: batida web/mobile com geolocalização, espelho de ponto, tolerâncias, justificativa de inconsistência com fluxo de aprovação do gestor, banco de horas, fechamento por competência (Portaria 671 — REP-P: registro imutável com hash e trilha) |
| **Senior HCM / TOTVS RH** | Férias: período aquisitivo/concessivo, saldo, alertas de férias vencendo (dobra), aprovação em 2 níveis (gestor → DP); histórico de movimentações (promoção, transferência, mudança salarial) como linha do tempo |
| **Gupy Admissão** | Dossiê digital único do colaborador (prontuário 360°) com documentos versionados e validade |
| **Apdata / eSocial** | Afastamentos tipificados (S-2230), ASO com validade e alertas (S-2220), desligamento com checklist |
| **Feedz / Omie DP** | Autoatendimento: o colaborador vê espelho de ponto, saldos e abre solicitações; o gestor aprova pela caixa de entrada |

### A.2 Reuso da plataforma (obrigatório)

- **`OrgEmployee` + `OrgJob` + organograma**: JÁ EXISTEM — o cadastro DP **estende** o colaborador com perfil 1:1 (`PersonnelEmployeeProfile`), no mesmo padrão LGPD do `CompensationEmployeeProfile` (dados sensíveis segregados, minimização de acesso).
- **GED Documentos**: dossiê digital = documentos do GED vinculados ao colaborador (tipos documentais próprios: contrato, CTPS, ASO, ficha registro), com validade/alerta já nativos.
- **Meu Dia**: todas as aprovações (justificativa de ponto, férias, admissão, desligamento) viram work items — sem tela paralela de aprovação.
- **MaintenanceScheduler**: alertas de fim de experiência (45/90), ASO vencendo, férias em dobra, documentos vencendo.
- **Forms builder**: fichas e checklists de admissão/desligamento configuráveis.
- **Importador CSV/XLSX** (padrão prize/compensation): carga inicial de colaboradores e importação de batidas de relógio físico.
- **Conectores externos** (SAP/Apdata já cifrados): exportação p/ folha e futura ponte eSocial.
- **AuditWriter, Zod pipes, listTake, DataTable/Sheet/ConfirmDialog**: padrão hardening 2026-07.

### A.3 Modelo de dados (novas tabelas Prisma)

| Tabela | Papel |
|---|---|
| `PersonnelEmployeeProfile` (1:1 OrgEmployee) | CPF, PIS, CTPS, RG, nascimento, contatos, endereço, dados contratuais (tipo de contrato, admissão, regime, jornada), foto |
| `EmployeeDependent` | Dependentes (IR/salário-família) |
| `EmploymentEvent` | Linha do tempo: admissão, promoção, transferência, afastamento, retorno, desligamento (integra com aprovações de cargo existentes) |
| `WorkShiftTemplate` / `WorkScheduleAssignment` | Escalas/jornadas (turnos, tolerância, DSR, noturno) e vínculo colaborador→escala com vigência |
| `TimeClockEntry` | Batida: timestamp, origem (WEB/MOBILE/REP/IMPORT), geolocalização, hash de integridade (Portaria 671), device info |
| `TimesheetDay` | Espelho consolidado por dia: previsto × realizado, extras, atrasos, faltas, inconsistências |
| `TimeAdjustmentRequest` | Justificativa/abono com fluxo (colaborador → gestor → DP) |
| `TimeBankEntry` | Banco de horas (crédito/débito, saldo, expiração) |
| `TimesheetPeriod` | Fechamento por competência (trava edição, gera resumo p/ folha) |
| `VacationPeriod` + `VacationRequest` | Aquisitivo/concessivo/saldo + solicitação com aprovação 2 níveis |
| `LeaveRecord` | Afastamentos/atestados (tipo eSocial, CID cifrado — dado sensível) |
| `MedicalExam` | ASO (admissional, periódico, retorno, mudança de risco, demissional) com validade |
| `OnboardingProcess` / `OffboardingProcess` | Admissão/desligamento digital com checklist (itens = forms/documentos GED) |

### A.4 Máquinas de estado

- **Admissão**: `RASCUNHO → COLETA_DOCUMENTOS → CONFERENCIA_DP → ADMITIDO` (efetiva OrgEmployee ativo + cria User opcional) | `CANCELADA`
- **Ponto (dia)**: batidas → consolidação (job noturno) → `OK | INCONSISTENTE` → justificativa → aprovação gestor → `FECHADO` na competência
- **Férias**: `SOLICITADA → APROVADA_GESTOR → APROVADA_DP → PROGRAMADA → EM_GOZO → CONCLUIDA` | `REPROVADA/CANCELADA`
- **Desligamento**: `SOLICITADO → CHECKLIST → EXAME_DEMISSIONAL → HOMOLOGADO` (inativa OrgEmployee + desativa User)

### A.5 Telas (rotas `/servico-pessoal`)

1. **Painel**: headcount ativo, admissões/desligamentos do mês, pendências de ponto, férias/ASO/experiência a vencer.
2. **Colaboradores**: lista (filtros por área/status) + **Prontuário 360°** (abas: Dados, Documentos-GED, Ponto, Férias, Afastamentos, Histórico/timeline).
3. **Ponto**: espelho por colaborador/equipe, inconsistências, justificativas, banco de horas, escalas, fechamento de competência.
4. **Férias**: calendário da equipe, saldos, solicitações.
5. **Afastamentos & Saúde**: atestados, ASOs, alertas.
6. **Admissões/Desligamentos**: kanban dos processos com checklist.
7. **Configurações**: escalas, tolerâncias, tipos de documento do dossiê, motivos de desligamento/afastamento.
8. **Autoatendimento**: widget "Registrar ponto" (topbar/Meu Dia) + "Minhas solicitações" no Meu Dia.

### A.6 Fases de entrega

| Fase | Entrega | Tamanho |
|---|---|---|
| **1 — Prontuário** | PersonnelProfile + dependentes + dossiê GED + timeline + import XLSX + telas Colaboradores/Prontuário. 1 migração | G |
| **2 — Ponto** ✅ *MVP entregue em 2026-07-10* | Escalas, batida web/mobile (geoloc), espelho, justificativas via Meu Dia, banco de horas, fechamento de competência. Migração `20260710120000` + módulo `personnel` + tela `/servico-pessoal/ponto`. Pendente da fase: import de batidas (REP), banco de horas acumulado multi-mês, DSR/adicional noturno, relatório p/ folha | G |
| **3 — Férias & Afastamentos** | Saldos, fluxos de aprovação, calendário, atestados, alertas | M |
| **4 — Admissão/Desligamento digital + Saúde** | Checklists (forms), coleta de documentos, ASO com alertas | M |
| **5 — Integrações & Relatórios** ✅ *implementada em 2026-07-11* | Relatórios de turnover (admissões/desligamentos/headcount/taxa por mês e área), absenteísmo (afastamentos por tipo/área + faltas de ponto + taxa sobre dias úteis), horas extras (saldo positivo do espelho por colaborador/área) e exportação da folha (CSV/XLSX consolidando ponto + afastamentos). Tudo sobre dados reais reaproveitando `periodReport`. Rotas `/personnel/reports/*` + tela `/servico-pessoal/relatorios`. Sem migração. Preparação eSocial/conectores fica para evolução futura | M |

---

## Parte B — Módulo Suprimentos (Compras & Estoque)

### B.1 Benchmark de mercado

| Ferramenta | O que copiamos |
|---|---|
| **SAP MM** | Ciclo Requisição → Cotação → Pedido → Recebimento → NF → Estoque; medição de serviço (SES — Service Entry Sheet) aprovada antes da NF de serviço |
| **TOTVS Protheus (Compras/Estoque)** | Mapa comparativo de cotações (mín. 3 fornecedores), alçadas de aprovação de pedido por valor, kardex por item/almoxarifado, custo médio móvel |
| **Sankhya / Senior** | Fila do comprador (triagem de requisições), requisição de retirada do almoxarifado com atendimento e baixa |
| **Omie / Bling** | Simplicidade no lançamento de NF vinculada ao pedido, saldo mínimo/máximo com alerta de reposição |

### B.2 O fluxo (exatamente como especificado, formalizado)

```
[Solicitante]                [Comprador]                    [Fornecedor/Fiscal]           [Almoxarifado]
Requisição (escolhe    →   assume na fila (Meu Dia)   →   ...
 itens + ESTOQUE destino)   Cotações/Negociação
                            (mapa comparativo)
                            Pedido de Compra (alçada) →   MATERIAL: entrega → NF material ─→ ENTRADA no estoque
                                                          SERVIÇO: executa → MEDIÇÃO aprovada → NF serviço
[Usuário]                                                                                  [Almoxarifado]
Solicita retirada ────────────────────────────────────────────────────────────────────→   atende e dá BAIXA
                                                                                           (kardex completo)
```

- **Material**: NF lançada = movimento `IN` no almoxarifado escolhido **na requisição**; saldo e custo médio atualizados.
- **Serviço**: NF só pode ser lançada com **medição aprovada** (trava de conformidade).
- **Retirada**: usuário solicita → almoxarife atende → movimento `OUT` com histórico completo (quem pediu, quem entregou, área/centro de custo, data, requisição de origem).

### B.3 Modelo de dados

| Tabela | Papel |
|---|---|
| `Supplier` | Fornecedor (CNPJ, contatos, condições de pagamento, avaliação) |
| `Warehouse` | Almoxarifado/estoque (vinculado a área do organograma) |
| `StockItem` | Catálogo: código, descrição, tipo `MATERIAL/SERVICO`, unidade, grupo, min/máx, custo médio |
| `StockBalance` | Saldo por item × almoxarifado |
| `PurchaseRequisition` + `Item` | Requisição: solicitante, área/centro de custo, **almoxarifado de destino**, urgência, justificativa |
| `Quotation` + `Item` | Cotação por fornecedor; mapa comparativo; vencedor com justificativa |
| `PurchaseOrder` + `Item` | Pedido: fornecedor, condições, alçada de aprovação por valor, envio |
| `ApprovalRule` | Alçadas (faixa de valor → aprovador/papel) |
| `ServiceMeasurement` + `Item` | Boletim de medição: período, quantidades executadas, fiscal aprova |
| `SupplierInvoice` + `Item` | NF entrada (material ou serviço): número/chave, XML/PDF anexo (GED), vínculo PO/medição |
| `StockMovement` | **Kardex**: `IN/OUT/TRANSFER/ADJUST`, origem (NF, retirada, inventário), qtde, custo, **saldo após**, ator |
| `MaterialWithdrawal` + `Item` | Solicitação de retirada → atendimento → baixa |
| `InventoryCount` (fase 5) | Inventário/contagem cíclica com acerto auditado |

### B.4 Máquinas de estado

- **Requisição**: `RASCUNHO → ENVIADA → EM_TRIAGEM → EM_COTACAO → PEDIDO_GERADO → ATENDIDA_PARCIAL → ATENDIDA` | `CANCELADA/RECUSADA`
- **Pedido**: `RASCUNHO → AGUARDANDO_APROVACAO → APROVADO → ENVIADO → ENTREGUE_PARCIAL → ENTREGUE → ENCERRADO` | `CANCELADO`
- **Medição**: `RASCUNHO → ENVIADA → APROVADA → FATURADA` | `CONTESTADA`
- **NF**: `LANCADA → CONFERIDA → ESTOCADA` (material) / `VINCULADA_MEDICAO` (serviço) | `DEVOLVIDA`
- **Retirada**: `SOLICITADA → (APROVADA) → ATENDIDA` | `RECUSADA/CANCELADA`

### B.5 Reuso da plataforma

- **Meu Dia**: fila do comprador, aprovações de pedido por alçada, fila de retiradas do almoxarife.
- **QR codes** (padrão asset-security): etiquetas de item/prateleira; retirada por scan.
- **GED**: XML/PDF da NF e contratos de fornecedor anexados como documentos.
- **MaintenanceScheduler**: alerta de item abaixo do mínimo; pedido sem entrega no prazo.
- **Organograma**: centro de custo da requisição; visibilidade por área (padrão scoped-read).
- **Importador XLSX**: carga do catálogo de itens e saldos iniciais.
- **External API**: futura integração SAP (pedidos/NF) pelos conectores existentes.

### B.6 Telas (rotas `/suprimentos`)

1. **Painel**: requisições abertas, pedidos por status, itens abaixo do mínimo, NFs pendentes, medições a aprovar.
2. **Requisições**: minhas + fila do comprador (assumir/triagem).
3. **Cotações**: mapa comparativo lado a lado, vencedor justificado.
4. **Pedidos**: emissão, alçada, acompanhamento de entregas.
5. **Medições de serviço**: boletins, aprovação do fiscal.
6. **Notas fiscais**: lançamento (material→estoque; serviço→medição).
7. **Estoque**: posição por almoxarifado, **kardex do item** (histórico completo), transferências.
8. **Almoxarifado**: fila de retiradas, atendimento com baixa, recebimento físico.
9. **Cadastros**: itens, fornecedores, almoxarifados, alçadas.

### B.7 Fases de entrega

| Fase | Entrega | Tamanho |
|---|---|---|
| **1 — Estoque básico** ✅ *implementada em 2026-07-11* | Warehouse, StockItem, StockBalance, StockMovement (kardex transacional), retirada parcial/total com baixa idempotente, ajuste, transferência e import XLSX. Migração `20260710140000` | M |
| **2 — Requisição → Pedido** ✅ *implementada em 2026-07-11* | Requisição multi-item com almoxarifado destino, claim atômico da fila do comprador no Meu Dia, pedido com alçadas congeladas, recebimento parcial/total e entrada automática no estoque. Migração `20260710150000` | G |
| **3 — Cotações + NF material** | Mapa comparativo, SupplierInvoice com entrada automática no estoque de destino | M |
| **4 — Serviços** | Medição (BM) com aprovação do fiscal + NF de serviço travada pela medição | M |
| **5 — Almoxarifado avançado** | Fluxo de retirada com aprovação, transferências, inventário, custo médio, curva ABC, alertas min/máx, QR | M |

---

## Parte C — Transversal (vale para os dois módulos)

1. **Módulos de negócio** em `business-modules.ts`: `servico-pessoal` (members: `personnel`) e `suprimentos` (members: `procurement`, `inventory`) + prefixos no `inferModule` do PortalGateGuard (`/api/personnel`, `/api/procurement`, `/api/inventory`). Entram no plano **ENTERPRISE** (e PERSONALIZADO sob demanda) — confirmar decisão comercial.
2. **Permissões** no `permission-catalog.ts`: `pessoal:*`, `ponto:*`, `ferias:*`, `compras:*`, `estoque:*` (view/create/update/approve/manage) — RBAC nativo.
3. **Meu Dia**: novos coletores no WorkItemIndex (aprovações de ponto/férias, fila do comprador, alçadas de pedido, retiradas).
4. **LGPD**: `PersonnelEmployeeProfile` segue o padrão de segregação do CompensationEmployeeProfile; CID/saúde cifrados; atualizar RoPA (módulo LGPD já existente).
5. **Auditoria**: AuditWriter central em todos os serviços; toda baixa/movimento de estoque com ator + motivo.
6. **Qualidade**: Zod em todos os inputs, `listTake` na paginação, testes unitários por serviço + suite E2E Playwright por fase (padrão `documents-ged.spec.ts`).
7. **Migrações**: uma por fase, aplicadas primeiro em dev; **PROD/Neon só com autorização expressa** (regra do projeto).
8. **Ordem sugerida**: Serviço Pessoal F1 → Suprimentos F1-F2 (valor operacional rápido) → DP F2 (ponto) → alternar fases conforme prioridade do negócio. Os módulos são independentes entre si; ambos dependem só do núcleo existente.
