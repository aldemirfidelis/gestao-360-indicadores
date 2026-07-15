# Diagnóstico Técnico — Folha de Pagamento e Obrigações Trabalhistas

Data: 2026-07-14 · Autor: engenharia (sessão Claude/Codex) · Status: Fase 4 iniciada em modo assistido

Este documento atende ao prompt-mestre do módulo de Folha: diagnóstico do que já existe no
Gestão 360, decisões de arquitetura e plano por fases. Princípio central: **evoluir o que
existe, sem duplicar cadastros** (OrgEmployee é a fonte única do colaborador — ver
docs/diagnostico-gestao-jornada.md e a integração 360 já implementada).

---

## 1. Inventário do que JÁ EXISTE (com nomes reais de modelos/serviços)

### 1.1 Colaborador e vínculo (reuso direto)
| Necessidade da folha | Onde já existe |
|---|---|
| Cadastro único do colaborador | `OrgEmployee` (nome, matrícula `registrationId`, cargo `jobId`→`OrgJob`, área `orgNodeId`→`OrgNode`, status ACTIVE/INACTIVE) |
| Dados pessoais/contratuais LGPD | `PersonnelEmployeeProfile` 1:1 (CPF, RG, PIS/PASEP, CTPS, nascimento, endereço, estado civil, escolaridade, `contractType` CLT/PJ/ESTAGIO/APRENDIZ/TEMPORARIO/AUTONOMO, `workRegime`, admissão, desligamento, vínculo com login `userId`) |
| Dependentes | `EmployeeDependent` (parentesco, nascimento, CPF, `isIrDependent`) — **falta**: finalidade estruturada com vigência (salário-família, plano de saúde, pensão) |
| Histórico funcional | `EmploymentEvent` (ADMISSAO, MUDANCA_CARGO, TRANSFERENCIA, DESLIGAMENTO…) |
| Salário contratual com vigência | `CompensationSalarySnapshot` (employeeId, `currentSalary Decimal(14,2)`, `effectiveFrom/effectiveTo`, motivo) — **já é o worker_salary_history** |
| Tabelas/faixas salariais | `CompensationSalaryTable` / `CompensationSalaryRange` / catálogo de cargos versionado |
| Multiempresa/estabelecimento | `Company` + `Branch`; isolamento manual por `companyId` (padrão scoped-read-before-mutate auditado em 2026-06) |
| Perfis/permissões | catálogo em `users/permission-catalog.ts` + `AccessProfile`; visibilidade por área (módulo access) |
| Dossiê/documentos | `EmployeeDossierFile` + GED/StorageService |
| Férias e afastamentos | `VacationRequest` (períodos aquisitivos, saldo CLT, dobra) + `LeaveRecord` (atestados, CID restrito) |
| SST | módulos SSMA/Segurança e Saúde; exames em `MedicalExam` (lifecycle DP) |

### 1.2 Controle de Ponto (Gestão de Jornada — Etapas 1-7 concluídas)
- Apuração canônica: `PersonnelService.buildMirrorDays`/`payrollDaysForUser` (tolerância por
  marcação, noturno, feriados, escalas cíclicas 12x36 com snapshot de vigência, abonos).
- Fechamento **versionado** por competência: `TimesheetPeriod` + `TimesheetPeriodVersion`
  (reabertura exige justificativa) + assistente com checklist (`closingPreview`).
- Banco de horas **livro-razão**: `TimeBankEntry` (FIFO, validade, EXPIRE/PAYOUT).
- **Eventos para folha já existem** (Etapa 5): `payroll.logic.ts` puro (HN, HE 50/100,
  adicional noturno 22h-5h, faltas, banco) + `PayrollRubricMap` (de-para p/ folha EXTERNA) +
  `PayrollExport` (CSV/JSON/TXT posicional com hash). Ocorrências (`AttendanceOccurrence`),
  NSR, AFD/AEJ/Espelho oficial (`legal-files.*`), `PersonnelLegalConfig` (CNPJ/CNO/INPI).
- Ou seja: o "resumo mensal por colaborador" do §7 do prompt já é derivável hoje; falta o
  **snapshot congelado por importação da folha**.

### 1.3 Transversais prontos
- Auditoria central (`AuditWriterService`, usado por 11+ serviços), logs pino com redação de
  sensíveis, Meu Dia (WorkItemIndex), Tarefas, Notificações + push (`generateAlerts` no
  `MaintenanceScheduler` de hora em hora), Comunicação, Gestão à Vista/Indicadores,
  API externa `/external/v1` + conectores cifrados (`prize-connectors` como referência),
  BullMQ atrás de flag, seed demo, multiempresa com troca de empresa ativa.

### 1.4 O que NÃO existe (gaps)
| Gap | Fase |
|---|---|
| Motor de cálculo de folha interno (proventos/descontos/encargos) | **F1-F2** |
| Rubricas internas versionadas com incidências (a `PayrollRubricMap` atual é só de-para p/ export) | **F1** |
| Parâmetros legais versionados (INSS/IRRF/FGTS/mínimo/salário-família) | **F1** |
| Competência/processamentos com máquina de estados e segregação de funções | **F1-F2** |
| Holerite | F2 |
| Férias/13º/rescisão CALCULADOS (hoje só o fluxo de aprovação de férias) | F3 |
| Benefícios (VT/VA/VR/planos) — não há modelo de dados | F3 |
| Consignados/pensões | F3 |
| eSocial (XML, assinatura, lotes, protocolos/recibos, totalizadores) | F4 |
| Certificado digital/cofre (há cifra de conectores, falta central de certificados) | F4 |
| FGTS Digital / DCTFWeb / EFD-Reinf / Qualificação Cadastral (modo assistido) | F5 |
| Banking Connector (CNAB 240, retorno, conciliação, dupla aprovação) | F6 |
| Contabilização (plano de contas, partidas, export) | F6 |
| Convenções coletivas estruturadas | F3 (regras) / F1 (modelo mínimo) |
| Campos eSocial do vínculo (categoria, CBO, lotação, FPAS/RAT/FAP…) | F4 (junto dos eventos) |

---

## 2. Decisões de arquitetura (Fase 1)

1. **Novo módulo NestJS `payroll`** (`apps/api/src/modules/payroll/`, rotas `/payroll/*`).
   Não colide com `/personnel/payroll/*` (que permanece como EXPORT para folha externa).
2. **Zero duplicação**: colaborador = `OrgEmployee`; salário = `CompensationSalarySnapshot`
   vigente; ponto = `payrollDaysForUser` + `payroll.logic` (mesma fonte do espelho);
   dependentes = `EmployeeDependent`. A folha só ADICIONA o que não existe.
3. **Dinheiro**: persistência `Decimal(14,2)`; motor de cálculo em **centavos inteiros**
   (aritmética exata, sem float), arredondamento half-up explícito e registrado passo a passo
   na memória de cálculo. Percentuais como basis points inteiros.
4. **Parâmetros legais versionados** (`PayrollLegalTableVersion`): `kind` + `effectiveFrom` +
   payload JSON + origem; `companyId` nulo = tabela nacional, preenchido = override da
   empresa. Nunca sobrescrever versão usada: alteração = nova linha. O cálculo grava no
   resultado **qual versão usou**. Valores NUNCA no código; seed inicial (tabelas oficiais
   2025 vigentes) entra como DADO com fonte marcada "seed — conferir com a contabilidade".
5. **Rubricas versionadas** (`PayrollRubric` + `PayrollRubricVersion`): natureza
   (PROVENTO/DESCONTO/BASE/INFORMATIVA), incidências (INSS/FGTS/IRRF/DSR/férias/13º/rescisão),
   prioridade, fórmula declarativa JSON (tipos: VALOR_FIXO, PERCENTUAL_DO_SALARIO,
   HORAS_DO_PONTO×fator, PERCENTUAL_DE_BASE). Construtor visual e fórmulas compostas = F2+.
   Validação de dependências/ciclos na publicação.
6. **Snapshot de ponto congelado** (`PayrollTimekeepingSnapshot`): a importação grava o
   resumo por colaborador com hash; recálculo só com nova importação explícita; alteração
   posterior do ponto NÃO muda folha calculada silenciosamente.
7. **Máquina de estados** do processamento (subset F1): DRAFT → IMPORTING → CALCULATING →
   CALCULATED | WITH_ISSUES → AWAITING_APPROVAL → APPROVED → CLOSED (+ REOPENED com
   justificativa/permissão própria, CANCELLED). Estados de eSocial/banco entram nas F4/F6.
8. **Segregação de funções** via permissões novas: `folha:view`, `folha:operate` (importar/
   calcular), `folha:approve` (aprovar — quem calcula não precisa poder aprovar),
   `folha:close` (fechar/reabrir), `folha:params` (rubricas/tabelas legais). Holerite do
   próprio colaborador (F2) terá chave própria. Gestor NÃO vê salário sem permissão.
9. **Sem integrações governamentais nesta fase**; F4+ usarão adaptadores (interface + modo
   assistido por arquivo/comprovante), sem scraping, certificados fora do banco (cofre).
10. **IA**: apenas explicativa (memória de cálculo já nasce estruturada para isso).

## 3. Aviso de conformidade

O motor nasce com parâmetros oficiais publicados (vigência registrada), mas **cálculo de
folha real exige validação da contabilidade/jurídico da empresa** (CCT, enquadramentos,
FPAS/RAT/FAP, regras específicas). A UI marcará resultados como "conferência interna" até a
empresa validar. Nada é transmitido a governo/banco automaticamente — não existe, nesta fase,
qualquer transmissão.

## 4. Fases (mapeadas ao prompt-mestre)

- **F1 (esta entrega)**: fundação — modelos, migração, parâmetros legais versionados com seed,
  rubricas versionadas com seed padrão, snapshot de ponto, motor puro (mensalista: salário,
  HE 50/100, noturno, faltas, INSS, IRRF c/ dependentes+simplificado, FGTS informativo) com
  memória de cálculo por passo e testes-ouro; competência/run com estados e aprovação/
  fechamento/reabertura auditados. Sem UI (F2).
- **F2**: folha básica completa + telas (dashboard da competência, assistente de fechamento,
  tela individual com memória), holerite (PDF + portal do colaborador), adiantamento.
- **F3**: férias/13º/rescisões calculados, benefícios, consignados, pensões, complementares,
  retroativos, convenções coletivas estruturadas.
- **F4**: eSocial (cadastro trabalhista completo, XML/assinatura/lotes/recibos/totalizadores,
  central de certificados com cofre, produção restrita). Iniciada em 2026-07-14 com
  central de certificados por referencia externa (sem PFX/senha no banco); fluxo periódico
  mensal para conferência: **S-1010** (tabela de rubricas), **S-1200** (remuneração) e
  **S-1299** (fechamento), com lote interno `STAGED_UNSIGNED`. Assinatura/transmissão seguem
  bloqueadas até cofre/assinador homologado; S-1010 sai com natRubr/codInc* em branco (exigem
  parametrização contábil). Não-periódicos: **S-2200** (admissão, do prontuário + salário-base;
  sexo/raça/estado civil/grau instr/CBO em branco) e **S-2299** (desligamento, do registro de
  rescisão — motivo Tabela 19, verbas rescisórias). **Reconciliação de totalizadores**: prévia
  de S-5001 (base/valor CP-INSS) e S-5002 (base/valor IRRF) derivada do cálculo interno para
  conferência (governo não retorna nada — nada transmitido).
  **Assinatura digital (2026-07-15):** custódia cifrada do certificado A1 na plataforma (modo
  `ENCRYPTED_DB`) — upload do .pfx, cifra AES-256-GCM de arquivo+senha (util `common/crypto.ts`),
  metadados via node-forge (titular/validade/serial), decifrado só em memória; `SigningService`
  com adaptador (ENCRYPTED_DB agora; ENV_REF/procuração/nuvem plugáveis depois); **assinatura
  XML-DSig real** (enveloped, C14N exclusiva, SHA-256, RSA-SHA256, X509 no KeyInfo, Reference ao
  Id) via node-forge + xml-crypto; lote vira `SIGNED`.
  **S-1210 (pagamentos, 2026-07-15):** evento de caixa (data do pagamento + líquido + IRRF retido)
  vinculado ao S-1200 — fato gerador do IRRF; um por colaborador com líquido positivo.
  **Transmissão SOAP (2026-07-15):** envelope `loteEventos` (grupo 1) com eventos assinados +
  SOAP 1.2; envio por **TLS mútuo** (o próprio A1 autentica a conexão via `https.Agent({pfx})`);
  `transmitBatch` faz **dry-run por padrão** (monta o envelope e NÃO envia) e só envia de verdade
  com `PAYROLL_ESOCIAL_TRANSMISSION_ENABLED=true` + endpoint configurado + `confirm:true`
  (produção real ainda exige `PAYROLL_ESOCIAL_PRODUCTION_ENABLED=true`); `queryBatch` consulta pelo
  protocolo. Guarda envelope/resposta/protocolo no lote para auditoria.
  **Env vars de transmissão** (droplet, quando ativar): `PAYROLL_ESOCIAL_TRANSMISSION_ENABLED`,
  `PAYROLL_ESOCIAL_SEND_URL_RESTRICTED`, `PAYROLL_ESOCIAL_SEND_URL_PRODUCTION`,
  `PAYROLL_ESOCIAL_QUERY_URL_RESTRICTED`, `PAYROLL_ESOCIAL_QUERY_URL_PRODUCTION`,
  `PAYROLL_ESOCIAL_PRODUCTION_ENABLED`. ⚠️ Os namespaces/versões do WSDL e as URLs oficiais DEVEM
  ser confirmados na doc oficial do eSocial antes de transmitir.
  **Schema-completude + validação XSD + totalizadores (2026-07-15):** S-2200 enriquecido com os
  campos obrigatórios (sexo/raça-cor/estCiv/grauInstr mapeados p/ as tabelas do eSocial, PIS,
  regime celetista, CBO) — novos campos `sex`/`raceColor` no prontuário e `cbo` no cargo (migração
  20260715160000); o que ainda falta (código IBGE do município de nascimento, e o preenchimento
  real de sexo/raça/CBO no cadastro) vira pendência sinalizada. **Validação XSD oficial**: util
  `payroll-xsd.util` (xmllint-wasm) valida cada evento contra os XSDs OFICIAIS que o operador
  baixa e aponta em `PAYROLL_ESOCIAL_XSD_DIR` (rota validate-xsd; erros viram pendências do
  evento; sem a pasta, pula sinalizando). **Totalizadores oficiais**: `parseOfficialTotalizers`
  extrai S-5001/S-5002/S-5011/S-5013 do retorno da consulta e a reconciliação compara com o
  cálculo interno, apontando divergências (antes só havia a prévia). Pendentes: UI para capturar
  sexo/raça/CBO no cadastro, tabela IBGE de municípios, e o encaixe do S-1210 no pagamento
  bancário (F6). ⚠️ Só a validação contra os XSDs oficiais confirma schema-completude real.
- **F5**: obrigações assistidas (FGTS Digital, DCTFWeb/Integra Contador opcional, EFD-Reinf,
  Qualificação Cadastral, DET, calendário legal).
- **F6**: Banking Connector (CNAB 240, dupla aprovação, retorno/conciliação, antifraude) +
  contabilização.
- **F7**: portal completo, Gestão à Vista, indicadores, anomalias, assistente explicativo.

## 5. Riscos e pendências conhecidas
- Valores legais do seed precisam de conferência da contabilidade (marcados na origem).
- DSR sobre variáveis, médias e regras de CCT: F2/F3 com validação jurídica (mesma ressalva
  já registrada na Etapa 5 da jornada).
- Droplet 1.9GB: novas dependências pesadas (assinatura XML etc.) só nas fases próprias.
- E2E de folha exige cenário com salário vigente + escala + ponto no dev.
