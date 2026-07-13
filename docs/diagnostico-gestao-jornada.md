# Diagnóstico — Gestão de Jornada e Serviço de Pessoal (Gestão 360)

Data: 2026-07-13 · Base auditada: commit `fada3fd` (main) · Autor: auditoria técnica assistida

Escopo: módulo Serviço Pessoal (`apps/api/src/modules/personnel/*`, telas `/servico-pessoal/*`),
com foco em Controle de Ponto/Jornada, para evoluí-lo a uma solução completa de Gestão de
Jornada **sem criar módulo paralelo e sem descartar o que existe**.

---

## 1. Inventário — o que existe e funciona (dados reais, sem mock)

### 1.1 Registro de ponto (`personnel.service.ts`, `TimeClockEntry`)
- Batida WEB / MOBILE / FACIAL / IMPORT com alternância IN/OUT automática por dia.
- Anti duplo clique (60s) + `pg_advisory_xact_lock` por colaborador (serializa batidas concorrentes).
- Carimbo do **servidor** (`punchedAt`), `dayKey` no fuso da empresa (UTC-3 fixo, constante documentada).
- Geolocalização opcional (lat/lng/accuracy), IP, user-agent, nota.
- **Cadeia de integridade** SHA-256 encadeada por colaborador (`hash`/`prevHash`, estilo Portaria 671).
- Batida nunca é apagada: ajuste marca `status=CANCELLED` e cria novas (append-only razoável).
- Ponto facial: descritor 128-D cifrado (AES-256-GCM), desafio de uso único (antirreplay), lockout
  5 falhas/15min, trilha `PersonnelBiometricAttempt`, consentimento LGPD versionado, revogação.

### 1.2 Espelho e apuração
- Espelho individual calculado on-the-fly (`buildMirrorDays`): previsto × trabalhado × saldo por dia,
  status (OK/OVERTIME/UNDERTIME/ABSENT/INCOMPLETE/DAY_OFF/IN_PROGRESS/VACATION/LEAVE), navegação mensal,
  dias futuros excluídos.
- Visão de equipe por dia (`teamMirror`) com status por colaborador.
- Férias/afastamentos **abonam** o dia automaticamente (integração real com `VacationRequest`/`LeaveRecord`
  via `PersonnelEmployeeProfile.userId`).

### 1.3 Escalas
- `WorkShiftTemplate` (regras semanais mon..sun `{start,end,breakMinutes}`, tolerância 0–120min).
- Jornada que vira a meia-noite é aceita **no previsto** (`end <= start ⇒ +24h`).
- `WorkScheduleAssignment` com vigência (atribuição nova encerra a anterior); resolução por dia.

### 1.4 Ajustes
- Colaborador propõe a lista completa de horários do dia (HH:MM crescentes, máx. 12) + motivo obrigatório.
- Aprovação/rejeição (`ponto:manage`) com justificativa obrigatória na rejeição; transacional.
- Aprovação cancela as batidas válidas do dia e recria como MANUAL preservando cadeia e original.

### 1.5 Fechamento e folha
- `TimesheetPeriod` por competência YYYY-MM: trava batida/ajuste/importação; reabertura.
- Fechamento consolida totais por colaborador (JSON `totals.users`).
- Relatório da competência + CSV (BOM p/ Excel) p/ conferência/folha.
- Banco de horas acumulado: competências fechadas usam consolidado; mês atual + 2 anteriores ao vivo.

### 1.6 Importação
- CSV de relógio/REP (email;data;hora | email;ISO), dedup por timestamp, bloqueio de competência
  fechada, cap 2.000 linhas, transação com timeout 120s, reordenação da alternância por dia.

### 1.7 Transversal
- Auditoria (`AuditWriterService`) em todas as ações críticas; permissões `ponto:view/clock/team/manage`;
  isolamento por `companyId` em **todas** as queries (verificado); Meu Dia integrado (aprovação de ajuste);
  throttle global 200 req/min + limites específicos na biometria.
- Relatórios DP (fase 5): turnover, absenteísmo, horas extras, exportação p/ folha (CSV/XLSX).
- Telas `/servico-pessoal/ponto` (5 abas), `/ponto-facial`, `/ferias`, `/colaboradores`, `/relatorios`,
  `/admissoes` — **todas conectadas a endpoints reais; nenhum dado mockado encontrado**.
- Testes: 16+ unit (time-clock.logic), 3 unit (biometric.logic), 10 E2E (`tests/e2e/time-clock.spec.ts`).

### 1.8 Cadastros correlatos já existentes na plataforma (reusar, não duplicar)
- Empresas (`Company` + multiempresa/subdomínio), estrutura organizacional (`OrgNode` = unidade/setor/área),
  cargos (`OrgJob`), colaboradores (`OrgEmployee` + `PersonnelEmployeeProfile` 1:1 LGPD), dependentes,
  dossiê (storage GED), admissão/desligamento (`EmploymentEvent`, lifecycle), ASO (`MedicalExam`),
  férias/afastamentos, visibilidade por área (módulo `access`), documentos (GED), automações
  (MaintenanceScheduler + workflows), comunicação, indicadores, planos de ação.

---

## 2. Funcionalidades incompletas

| Item | Situação |
|---|---|
| Escalas | Só padrão semanal fixo; sem 12x36, ciclos (4x2, 6x1 rotativo), revezamento, múltiplos intervalos |
| Banco de horas | Saldo único acumulado; sem contas, extrato, validade/vencimento, limites, compensação × pagamento |
| Fechamento | Trava e consolida, mas sem assistente por etapas, pendências, ciência, versão do fechamento |
| Exportação folha | CSV consolidado (h previstas/trabalhadas/saldo/faltas); sem eventos por rubrica/código de folha |
| Aprovação | Nível único (solicitante → `ponto:manage`); sem alçadas, delegação, SLA, lote |
| Offline | Fila offline existe na plataforma (rondas), mas **não** para batida de ponto |
| Comprovante | Batida não gera comprovante para o trabalhador |

## 3. Regras incorretas (bugs de regra encontrados no código)

1. **Feriados não existem** — não há tabela nem tratamento. Feriado em dia com escala conta como
   **falta (ABSENT)** e gera débito no banco; trabalho em feriado não gera nenhum adicional.
   `plannedMinutesFor()` só olha o dia da semana. *Impacto direto em saldo/folha hoje.*
2. **Escala editável reescreve o passado** — `updateTemplate` altera `weeklyRules` do template sem
   versionamento; como o espelho é calculado on-the-fly, **espelhos históricos (inclusive de meses
   ainda abertos) mudam retroativamente**. Viola "toda regra deve possuir vigência/versão".
3. **Jornada noturna quebra no pareamento** — o previsto aceita virar a meia-noite, mas as batidas
   são agrupadas pelo `dayKey` civil do instante: a saída após 00:00 cai no dia seguinte. Resultado:
   dia do turno fica INCOMPLETE e o dia seguinte ganha 1 batida órfã.
4. **Importação altera batida original** — após inserir, o import faz `UPDATE kind` para reordenar
   IN/OUT (linha ~309). Além de violar imutabilidade estrita, o `kind` gravado deixa de corresponder
   ao payload do hash (o hash usa "IMPORT" fixo), enfraquecendo a verificação da cadeia.
5. **Tolerância aplicada ao saldo do dia**, não por marcação — o padrão legal (CLT art. 58 §1º) é
   5min por marcação / 10min por dia. O modelo atual (tolerância X sobre o diff total) é defensável
   como política interna, mas não pode ser apresentado como a tolerância legal.
6. **Reabertura de competência sem justificativa e sem versão** — fechar de novo sobrescreve o
   consolidado anterior (upsert), sem histórico do fechamento anterior.
7. **Fechamento de mês antigo usa regras atuais** — `computeMonthTotals` recalcula com a escala
   vigente resolvida por assignment (ok), mas com as `weeklyRules` **atuais** do template (item 2).

## 4. Dados mockados
Nenhum encontrado no módulo (todas as telas consomem endpoints reais). ✔

## 5. Telas sem conexão com backend
Nenhuma no módulo. Botões auditados executam mutations reais. ✔

## 6. Cálculos frágeis (funcionam, mas sem robustez exigida)
- **Intervalo não é medido**: `breakMinutes` é abatido do previsto; com 2 batidas o dia é jornada
  corrida — intervalo não realizado/insuficiente passa despercebido (risco de hora extra devida).
- **Interjornada (11h) e excesso de jornada (10h/dia) não verificados.**
- **Sem DSR, adicional noturno (20%), hora noturna reduzida (52:30), faixas de HE (50%/100%),
  domingo/feriado** — o "saldo" único não alimenta folha real.
- **Memória de cálculo inexistente** — o espelho não guarda como chegou ao número (marcações
  consideradas/desconsideradas, regra/versão aplicada, etapas).
- Banco de horas: recomputa meses abertos a cada chamada (ok em escala atual; sem cache/período).
- `COMPANY_UTC_OFFSET_MINUTES = -180` fixo: correto para America/Sao_Paulo hoje, mas cravado
  (Fernando de Noronha/expansão internacional exigiria timezone por empresa/estabelecimento).

## 7. Riscos legais (exigem validação jurídica antes de qualquer declaração)
- O sistema **não é** hoje um REP-P certificável: sem NSR sequencial, sem comprovante de marcação,
  sem AFD/AEJ (Portaria 671), sem Atestado Técnico/Termo de Responsabilidade, sem registro INPI.
  A cadeia de hash é um bom alicerce, mas não substitui os artefatos legais.
- Espelho sem **ciência do colaborador** (assinatura mensal).
- Feriados/DSR/noturno ausentes (itens 3.1 e 6) impactam verbas devidas.
- Ponto por exceção não é suportado (se algum cliente operar assim, exige instrumento autorizador).
- Biometria: base sólida (consentimento, cifra, revogação), mas faltam log de consulta/exportação
  do template, política de retenção/descarte e RIPD documentado.

## 8. Riscos de segurança
- **Abrangência do gestor**: `teamMirror`, `pendingAdjustments`, `listAssignments`, `options` e
  relatórios expõem a **empresa inteira** a quem tem `ponto:team`/`ponto:manage` — não usam a
  visibilidade por área que a plataforma já possui (módulo `access`). Gestor vê fora da sua equipe.
- `summary()` expõe contagem de ajustes pendentes da empresa a qualquer `ponto:view` (vazamento menor).
- Batida não registra hora do dispositivo (só servidor) — correto para REP-P, mas sem campo para
  auditoria de divergência quando houver offline.
- Sem dispositivos autorizados/geofence — geo é apenas registrada, nunca validada (ponto fora do
  local não gera divergência).
- Isolamento multi-tenant: **OK** (todas as queries filtram `companyId`).

## 9. Problemas de usabilidade
- Tela única `/servico-pessoal/ponto` com 5 abas em tabelas — funcional, mas sem calendário de
  escala, timeline de marcações, planejador visual, densidade ajustável ou "Entenda este cálculo".
- Editor de escala é um formulário semanal simples (suficiente p/ fixa; inviável p/ ciclos).
- Fechamento é um botão por competência — sem checklist de pendências.
- Portal do colaborador: "Meu Ponto" é bom, mas não mostra "próxima marcação esperada"/"previsão de saída".

## 10. Funcionalidades ausentes (mapa de gaps vs. blueprint completo)
Cadastros: estabelecimentos (multi-CNPJ), CNO/CAEPF, centros de custo, sindicatos, CCT/ACT com vigência,
feriados, motivos de abono/ocorrência, locais/dispositivos autorizados, coletores. Motor de jornadas:
ciclos/12x36/revezamento/intervalos múltiplos/pré-assinalado/sobreaviso/prontidão. Planejador visual de
escalas. Registro: totem/QR/AFD import posicional/API pública/offline/NSR/comprovante. Apuração: motor
independente com memória de cálculo e rubricas. Central de ocorrências. Workflow de aprovação multi-nível.
Banco de horas completo. Assistente de fechamento. Motor de eventos p/ folha + conciliação. Central
fiscal (AFD/AEJ/p7s). Painel do gestor em tempo real. Dashboards. Automações de jornada. IA explicativa.

## 11. Impacto das mudanças
- **Sem quebra**: tudo aqui é aditivo (novas tabelas/colunas opcionais) ou correção de cálculo.
  IDs e batidas existentes não são tocados; espelhos passados só mudam onde a regra estava errada
  (feriado/noturno) — e isso será versionado (regra nova tem vigência; não recalcula competência fechada).
- Migrações: novas tabelas (feriados, versões de escala/fechamento, ocorrências, banco, eventos)
  + colunas novas em `TimeClockEntry` (NSR, deviceTime, syncId, deviceId) — todas nullable/aditivas.
- Dados em produção: TimeClockEntries reais da Goiasa desde 2026-07-10 — preservação obrigatória. ✔

## 12. Plano de implementação (7 etapas)

### ETAPA 1 — Correções críticas (sem redesenho)
1. **Feriados**: tabela `company_holidays` (empresa + data + nome + âmbito) + CRUD + espelho trata
   feriado (não conta falta; trabalho em feriado marcado p/ adicional futuro).
2. **Vigência de regra de escala**: congelar `weeklyRules`/tolerância por vigência — snapshot na
   `WorkScheduleAssignment` no momento da atribuição; edição de template em uso gera nova versão
   (template continua como "modelo"; o cálculo usa o snapshot). Não recalcula o passado.
3. **Jornada noturna**: pareamento por jornada (batida OUT nas primeiras horas do dia seguinte é
   atribuída ao dia da escala noturna), parametrizado pela escala do dia.
4. **Import imutável**: eliminar `UPDATE kind`; `kind` vira derivado no cálculo (coluna mantida
   como informativa da batida original; hash permanece consistente).
5. **Abrangência do gestor**: `teamMirror`/pendências/assignments/relatórios filtrados pela
   visibilidade por área já existente (`access`), com `ponto:manage` corporativo p/ DP.
6. **Reabertura auditada**: justificativa obrigatória + versão do fechamento (`timesheet_period_versions`
   guarda cada consolidado; fechar de novo cria versão, não sobrescreve).
7. Registrar `deviceTime`/`syncId` na batida (base p/ offline e auditoria).

### ETAPA 2 — Marcações imutáveis formais + escalas cíclicas + apuração com memória
NSR sequencial por empresa; comprovante de marcação (PDF/registro); escalas por ciclo (12x36, 4x2,
rotativas) com `shift_cycles`; apuração como serviço independente gravando `calculation_memories`
(marcações consideradas/desconsideradas, regra+versão, etapas, resultado) + "Entenda este cálculo";
intervalos medidos (mín/máx, pré-assinalado); interjornada e teto diário como ocorrências.

### ETAPA 3 — Ocorrências, ajustes granulares, aprovações e portal
`attendance_occurrences` (tipos do blueprint §7) geradas na apuração; ajustes por tipo (abono,
esquecimento, trabalho externo...) com motivos configuráveis; workflow de aprovação multi-nível
reutilizando o motor de workflows existente; portal do colaborador mobile-first (jornada de hoje,
próxima marcação, previsão de saída, banco, espelhos, ciência).

### ETAPA 4 — Banco de horas completo + afastamentos + assistente de fechamento
`time_bank_accounts`/`time_bank_entries` (crédito/débito/validade/limites/extrato/vencimento);
recálculo ao aprovar ausência preservando resultado anterior; assistente de fechamento em 12 passos
com pendências por setor/gestor, ciência de espelho, bloqueio transacional e versão.

### ETAPA 5 — Eventos para folha
`payroll_events` + mapeamento rubrica interna → código da folha (por empresa/vigência);
exportações CSV/XLSX/TXT posicional/API; conciliação exportado × recebido; histórico.

### ETAPA 6 — Central fiscal / REP-P
AFD, AEJ, Espelho de Ponto Eletrônico oficiais com testes de leiaute; NSR; assinaturas/p7s.
⚠️ Itens que **exigem providências externas**: registro do programa no INPI, Atestado Técnico e
Termo de Responsabilidade, certificado digital, validação jurídica dos leiautes e das políticas
(tolerância, DSR, CCT). O sistema não declarará conformidade automaticamente.

### ETAPA 7 — Dashboards, automações e integrações 360
Painel do gestor em tempo real; indicadores (absenteísmo, HE, banco a vencer) publicados no módulo
de Indicadores/Gestão à Vista; automações (gatilhos §19) no MaintenanceScheduler/central de automações;
tarefas para ocorrências críticas; comparação ponto × acessos (Segurança Patrimonial) como divergência.

## Arquivos/entidades que serão modificados (Etapas 1–2)
- `apps/api/prisma/schema.prisma` — novas tabelas: `company_holidays`, `timesheet_period_versions`,
  snapshot em `work_schedule_assignments` (colunas `rulesSnapshot`, `toleranceSnapshot`),
  colunas novas em `time_clock_entries` (`deviceTime`, `syncId`, `deviceId`, `nsr` na Etapa 2) — aditivas.
- `apps/api/src/modules/personnel/time-clock.logic.ts` (+spec) — feriados, pareamento noturno, kind derivado.
- `apps/api/src/modules/personnel/personnel.service.ts` — espelho/fechamento/import/abrangência.
- `apps/api/src/modules/personnel/personnel.controller.ts` — CRUD de feriados, versões.
- `apps/web/app/(app)/servico-pessoal/ponto/page.tsx` — feriados na UI, motivo na reabertura, versões.
- `tests/e2e/time-clock.spec.ts` — novos cenários (feriado, noturno, versão de regra).

## Itens que exigem decisão do negócio antes de implementar
1. Política de tolerância: manter "tolerância de saldo" atual, adotar 5min/10min legal, ou ambas.
2. DSR: se haverá desconto de DSR por falta injustificada (depende de política/CCT).
3. Banco de horas: prazo de validade (6 meses acordo individual / 12 meses CCT) e limites.
4. REP-P: se a empresa pretende operar o Gestão 360 como REP-P oficial (implica INPI/atestado) ou
   como programa de tratamento recebendo AFD de REPs físicos — muda a prioridade da Etapa 6.
5. Timezone por estabelecimento (necessário só se houver operação fora de UTC-3).
