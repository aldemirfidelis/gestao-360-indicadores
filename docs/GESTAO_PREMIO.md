# Gestão de Prêmio (Remuneração Variável)

> Módulo corporativo do Gestão 360 para controlar o ciclo completo da remuneração
> variável: **Programa → Anexo → Aprovação → Indicadores → Metas → Realizado →
> Fechamento → Base Elegível → Eventos → Transitoriedade → Ajustes → Exceções →
> Cálculo → Conferência → Aprovação → Folha → Espelho → Auditoria**.
>
> Documento vivo. **Módulo completo (Fases 1 a 7)** entregue e validado: Fundação +
> Governança, Realizado + Previsto × Realizado, Base Elegível (Apdata), Motor de
> Cálculo + Conferência, Folha, Espelho (PDF) e Relatórios + Auditoria + IA assistiva.
> Conformidade conferida contra os documentos e o prompt — ver seção 8.
> **Em produção** no droplet (PostgreSQL local; 6+1 migrações aplicadas).

## 0.9. Calibração do motor pelas planilhas oficiais (Bases_calculo) (entregue)

> Engenharia reversa COMPLETA dos 5 arquivos de `Gestao_premio/Bases_calculo`
> (VBA extraído de BaseAnexos.xlsm, Ferramenta Calculo, Ferramenta de Apuração,
> Ferramenta de Criação de Faixas; anexo real PREMIO ESTRADAS 0561). O motor
> agora replica a semântica EXATA do processo legado — engine **v1.1.0**.

**Regras extraídas do VBA (fonte da verdade do processo):**
- **Faixas** (FaixaAtingida/modRealizadosFaixas): degraus discretos com limites
  INCLUSIVOS; faixa 0 explícita pagando 0%; **extrapolação por sentido** —
  acima de todas → faixa TOPO ("maior melhor") / faixa ZERO ("menor melhor"),
  abaixo de todas → o inverso. SEM interpolação entre faixas.
- **Ganho** = %PAGO(faixa atingida) × salário_possível_indicador, onde
  salário_possível_indicador = potencial_total × peso/100. **Peso é % do
  potencial** (Σ pesos = 100; sem normalização — pagar exatamente a fração).
- **Fórmulas do CALCULO (R1C1)**: DiasDireito = max(30 − faltas − acid.trab −
  aux.doença − afastamentos − férias − licenças − suspensão − outros, 0)
  (atestado NÃO reduz dias); Moderadores = max(1 − 0,34×(faltas+susp) −
  0,5×medidas − 0,5×acidentes − 0,2×diasAtestadoDesc, 0); Possível/Atingido =
  salário × % / **30** × DiasDireito (mês comercial); Final = Atingido × Moder.
- **Atestados** (DatasAtestados): o atestado MAIS ANTIGO do período é abonado;
  apenas os dias dos demais descontam (20%/dia).
- **Admissão no mês**: dias-base = 30 − dia + 1 (antes do mês = 30; depois = 0).
- **Medidas**: "Advertência Verbal" NÃO conta. **Acidentes**: só "com Afastamento".
- **Sugestão de faixas** (SugerirFaixas): distribuição LINEAR zero→meta em N
  faixas (2..6), %pago linear = f/(N−1), gap = 1 unidade da precisão decimal.

**Mudanças aplicadas no módulo (sem migração de banco):**
- `prize-evaluation.ts`: extrapolação por sentido do indicador; interpolação
  linear SÓ quando o indicador não tem faixas (com faixas = degrau).
- `prize-calc-engine.ts` (**v1.1.0**): pesos como % do potencial (aviso
  WEIGHT_WARN na memória quando Σ≠100); moderadores agregados por tipo com novo
  critério **PER_DAY_AFTER_FIRST** (1ª ocorrência abonada — regra do atestado);
  helpers puros `commercialDaysFromAdmission` (30−dia+1) e `deriveEntitledDays`
  (dias de direito = base − ausências; atestado fora).
- `prize-calc.service.ts`: passa direção + datas dos eventos; deriva dias de
  direito (admissão + ausências) quando o snapshot não traz `workedDays`.
- **Gerador de faixas** (réplica da Ferramenta de Criação de Faixas):
  `prize-ranges.util.ts` + `POST /prize/indicators/:id/ranges/suggest` e
  `/ranges/bulk`; UI na tela Indicadores ("Gerar faixas" — zero/meta/qtde, com
  prévia e confirmação; usa o parâmetro vigente quando não informado).
- **Seed de moderadores do modelo oficial** (`POST /prize/calc/moderators/
  seed-defaults` + botão na aba Moderadores): falta 34%/dia, suspensão 34%/dia,
  medida 50%/ocorrência, acidente 50%/ocorrência, atestado 20%/dia c/ 1º
  abonado — criadas como regras normais EDITÁVEIS (nada fixo em código).
- **Eventos de ausência** no import: + FERIAS, LICENCA, AFASTAMENTO,
  AUXILIO_DOENCA (categorias do Apdata "FALTAS E ATESTADOS"; reduzem dias de
  direito; aliases licença maternidade/paternidade/não remunerada etc.).
- **Testes**: +17 (golden tests com os números REAIS da planilha: zero 95/meta
  100/peso 60/potencial 8,33% → 4,998%; faixas exatas do Base_SE; extrapolação;
  atestado abonado; fórmula AE composta). Suíte **319 verdes**; tsc/lint ok.

**Pendência de fidelidade (residual, documentada):** duplo impacto de
falta/suspensão (reduz dias E modera 34%) é reproduzido ao usar eventos de
ausência + regras seed. A planilha também diferencia "Gera Cálculo?/Gera
Espelho?" por colaborador — coberto por elegível/bloqueado no snapshot.

## 0.8. Importação manual da base elegível (CSV/XLSX) — contingência do Apdata (entregue)

> Requisito reaberto por decisão de produto (antes "arquivo só via API"): enquanto
> o conector Apdata não está ligado, a planilha é o caminho de contingência
> OFICIAL — com rigor de folha de pagamento (módulo paga gente; não pode errar).

- **Campos conforme a documentação** (matriz POC itens "Integração com Apdata"):
  base elegível = matrícula, nome, CPF, vínculo, filial, unidade, cargo, função,
  área/lotação, setor, centro de custo, salário base, admissão, desligamento,
  situação, dias trabalhados; eventos = FALTA, ATESTADO, MEDIDA_DISCIPLINAR,
  SUSPENSAO, ACIDENTE, TREINAMENTO (dias/valor/data/descrição).
- **Parser/validador PURO** (`prize-eligible-import.util.ts`, 19 testes):
  cabeçalhos tolerantes a acento/caixa ("Matrícula", "Centro de Custo");
  **CPF com validação de dígito verificador** (inválido = erro, nunca mascarado
  em silêncio); números pt-BR ("3.500,75") e en; datas dd/mm/aaaa, ISO, Date e
  **serial Excel**; matrícula duplicada no arquivo = erro; dias 0..31; situação
  normalizada (ATIVO/DESLIGADO/AFASTADO/FÉRIAS/TREINAMENTO) com avisos de
  inconsistência (desligado sem data etc.); **tipo de evento desconhecido =
  ERRO** (tipo errado não casaria com regra de moderador → pagamento indevido);
  colunas desconhecidas reportadas (typo).
- **Fluxo em 2 etapas, tudo-ou-nada**: `POST /prize/eligible/competence/:id/`
  `import/preview` (dry-run: erros/avisos por linha+coluna + **prévia da
  conciliação** contra o lote atual, nada gravado) → `import/file` (commit;
  **revalida tudo no servidor** e rejeita o arquivo inteiro se houver 1 erro).
  Reusa o `import()` oficial: snapshot imutável por lote, CPF mascarado,
  conciliação, trilha de auditoria. Arquivo só de eventos = modo
  `EVENTS_APPEND` (anexa ao lote corrente via `appendEvents`).
- **Formatos**: CSV (parse no cliente com papaparse, `dynamicTyping` OFF para
  preservar zeros à esquerda de matrícula/CPF) e **XLSX** (base64 → exceljs no
  servidor; abas `Colaboradores` + `Eventos`). **Modelo XLSX para download**
  (`GET /prize/eligible/template`): abas Colaboradores/Eventos com exemplo
  fictício + aba Instruções.
- **UI** (`/gestao-premio/colaboradores`): Baixar modelo → upload → prévia
  (badges válido/erros, lista por linha/coluna, avisos, colunas ignoradas,
  conciliação simulada) → **Confirmar importação** (só habilita com 0 erros).
- **Benchmark de mercado** (verificação de contexto): o desenho segue o padrão
  dos ICMs líderes (Xactly Incent, Varicent, CaptivateIQ, SAP SuccessFactors
  Incentive Mgmt; nacionais AchieveMore/Mereo): plano versionado → motor de
  cálculo auditável c/ memória → statement individual → integração folha →
  trilha completa. Diferenciais já contemplados: preview antes de commit,
  versionamento de reprocesso (nunca sobrescrever), segregação de função.
- **Testes**: suíte API **302 verdes** (19 novos). tsc verde (api+web); lint verde.

## 0.7. Consolidação de reuso — menos telas, plataforma como fonte única (entregue)

> Revisão pós-entrega a pedido do produto: o módulo havia criado telas/fluxos
> paralelos onde a plataforma já tinha recurso equivalente. Princípio aplicado:
> **o prêmio PARAMETRIZA; o cadastro e o lançamento vivem nos módulos nativos.**

- **Indicadores (reuso real do módulo nativo)**: o caminho PADRÃO de criação
  agora é **selecionar um indicador do catálogo da plataforma** — nome, unidade,
  sentido e descrição são **herdados no backend** (`create` resolve o
  nativo e preenche; `GET /prize/indicators/platform-options` expõe o catálogo
  sob `prize:view`, sem exigir `indicators:view`). O formulário manual virou
  exceção explícita ("indicador exclusivo do prêmio"). A tela foi reposicionada
  como **parametrização** (metas/zeros/pesos/faixas) e cada item exibe badge
  `🔗 Plataforma` ou `Exclusivo do prêmio`.
- **Realizado sync-first**: "Sincronizar da plataforma" é a ação primária; a
  grade **bloqueia digitação manual para indicadores vinculados** (corrige-se na
  origem — módulo Lançamentos — e sincroniza). Lançamento manual continua apenas
  para indicadores exclusivos do prêmio.
- **Menos telas (16 → 13 rotas no menu)**, sem perder função:
  - `previsto-realizado` → aba "Previsto × Realizado" dentro de **Realizado**
    (as duas telas já consumiam o MESMO endpoint);
  - `moderadores` → aba "Moderadores" dentro de **Ajustes e Exceções**;
  - `auditoria` → aba "Auditoria" dentro de **Relatórios e Auditoria**.
  As rotas antigas fazem `redirect()` (favoritos não quebram).
- **Sem mudança de banco**: nenhuma migração nova; `PrizeIndicator` permanece
  como tabela de parametrização (peso/tipo/faixas por programa), agora vinculada
  ao `Indicator` nativo por `platformIndicatorId` como caminho padrão.
- **Validação**: tsc verde (api+web); suíte API **283 verdes**.
- **Duplicação remanescente (decisão documentada)**: `PrizeIntegrationConfig`
  (conectores do prêmio com `secretRef` por env) coexiste com o framework de
  integrações da plataforma (`ExternalIntegration`, credenciais cifradas,
  provider APDATA). O prompt (§31) pedia conectores dedicados por empresa com
  jobs por competência; recomendação futura: convergir credenciais para
  `ExternalIntegration` mantendo `PrizeIntegrationJob` para os lotes.

## 0.6. Upgrade de Automação — zero planilha no fluxo padrão (entregue)

> Princípio: **todo lançamento acontece na plataforma ou chega por API**;
> arquivo/planilha vira contingência, nunca o caminho padrão.

- **Realizado 100% automático**: `PrizeIndicator.platformIndicatorId` vincula o
  indicador do prêmio ao **indicador nativo** (módulo Indicadores/Lançamentos).
  `PrizeSyncService.syncActuals` puxa `IndicatorResult` do período da competência
  (mesmo `periodRef`), grava via `launch` oficial (respeita travas, parâmetro
  vigente, trilha) e só atualiza o que mudou. O legado já desemboca nesses
  indicadores (`externalSource`), e sistemas externos já podem postar resultados
  via `POST /external/v1/results` — ou seja, **uma única fonte alimenta o prêmio**.
  Botão "Sincronizar da plataforma" na tela do Realizado; vínculo configurável
  no cadastro do indicador do prêmio (migração `20260610100000`).
- **Base elegível por API (sem arquivo)**: `POST /external/v1/prize/eligible`
  (escopo `prize:write`) — o Apdata/folha empurra colaboradores + eventos por
  `programCode + year/month`; a competência é **auto-criada** se não existir;
  snapshot imutável por lote + conciliação automática na resposta. CPF mascarado
  ao persistir. `POST /external/v1/prize/events` anexa eventos (faltas/atestados/
  medidas/acidentes) sem novo lote. Identidade sintética "API Externa" na trilha.
- **Automatização da competência** (`POST /prize/competences/:id/autopilot`, botão na
  Apuração): sincroniza realizado → roda checklist → **apura automaticamente** se
  não houver pendência impeditiva (explica o motivo quando não roda). Nunca fecha
  competência nem publica espelho sozinho — etapas de alçada continuam humanas.
- **Testes**: `prize-sync.service.spec.ts` (3 cenários). Suíte total **283 verdes**.

## 0.5. Fase 7 — Relatórios + Auditoria + IA assistiva (entregue)

- **Relatórios** (`/gestao-premio/relatorios`): apuração por colaborador +
  agregações por **área / cargo / centro de custo** + totais; exportação **CSV**;
  aba **operacionais** (pendências: anexos sem aprovação, indicadores sem
  realizado, competências abertas, lotes rejeitados, espelhos não publicados,
  ciência pendente). `prize-reports.service` (sem dados fixos).
- **Auditoria** (`/gestao-premio/auditoria`): trilha imutável (`PrizeAuditLog`)
  com filtro por entidade — quem/o quê/quando/por quê.
- **IA assistiva** (`prize-ai.service`, reusa `GeminiService`): explica a memória
  de cálculo de um colaborador e gera resumo executivo da competência. **Sempre
  como recomendação** (`recommendation: true`), nunca altera valores/regras;
  **fallback determinístico** (rule-based) quando não há chave de IA configurada.
- **Conformidade do motor corrigida**: **transitoriedade** (registro por dias,
  direito sim/não → bloqueio, trilha na memória) e **desligamento** (proporcional
  por dias, registrado) agora ligados ao `computePrize` e à orquestração
  (engine specs cobrindo ambos).
- **Super Admin**: o módulo `prize` está no catálogo da plataforma
  (`CATALOG_MODULES` → `PLATFORM_MODULES`), habilitável/bloqueável por empresa e
  incluído nos planos — gerenciável pelo Portal Admin Global existente.
- **Testes**: suíte total **280 verdes**. tsc verde (api+web).

## 0.4. Fase 6 — Espelho do Prêmio (PDF) (entregue)

- **Banco** (aditivo): enum `PrizePayslipStatus` + tabela `PrizePayslip`.
  Migração `20260609220000_prize_payslip`. **Snapshot congelado** (`data`) por
  **versão** — publicar nunca sobrescreve um espelho publicado (gera nova versão;
  a anterior vira `SUPERSEDED`).
- **Emissão em lote** a partir da apuração: cada espelho congela colaborador
  (matrícula, área, cargo, CC, salário, dias), resumo do prêmio (potencial,
  atingimento, proporcionalidade, bruto, reduções, ajustes, gratificação, final)
  e a **memória de cálculo** completa, com versão do cálculo + hash + data.
- **PDF no cliente** (jsPDF + autoTable, já no projeto): demonstrativo profissional
  gerado a partir do snapshot — download/impressão sem dependência nova no backend.
- **Publicação** (individual ou em lote, move competência → `PAYSLIPS_PUBLISHED`)
  e **controle de ciência** (colaborador confirma recebimento). Permissão
  `prize:payslip:publish` para emitir/publicar; ciência por `prize:view`.
- **Frontend** `/gestao-premio/espelhos`: emitir, publicar, baixar PDF e dar ciência.
- **Testes**: suíte prize 31 verdes (guard + utilitários). tsc verde (api+web).

## 0.3. Fase 5 — Integração com a Folha (entregue)

- **Banco** (aditivo): enums `PrizePayrollBatchStatus`/`PrizePayrollItemStatus` +
  tabelas `PrizePayrollBatch`/`PrizePayrollBatchItem`. Migração
  `20260609210000_prize_payroll`.
- **Geração de lote** a partir da apuração (run SUCCESS/PARTIAL): itens com
  matrícula, nome, **rubrica/verba**, valor final, status; bloqueados (valor 0)
  entram como `BLOCKED` com motivo e ficam fora do arquivo. Código do lote por
  competência. Helper puro `buildPayrollItems`/`payrollToCsv`/`reconcileReturn`
  (testado).
- **Saída desacoplada**: exportação **CSV** (download autenticado, BOM UTF-8,
  separador `;`), pronta para arquivo/interface/API.
- **Envio + retorno**: marcar enviado com **protocolo** (move competência →
  `SENT_TO_PAYROLL`); **importar retorno** (matrícula;status;código;mensagem),
  conciliação automática (aceitos/rejeitados/não-encontrados), contagem de
  rejeições, cancelamento de lote.
- **Frontend** `/gestao-premio/folha`: monitoramento de lotes, itens, export,
  envio e conciliação do retorno. Permissão `prize:payroll:manage`.
- **Testes**: suíte total **277 verdes**. tsc verde (api+web).

## 0.2. Fase 4 — Motor de Cálculo + Apuração (entregue)

> **Calibração:** revisados TODOS os arquivos da pasta `Gestao_premio` (PDF, DOCX,
> XLSX, PPTX, .bpm). Os documentos definem o **conjunto completo de regras/etapas**
> (idêntico ao processo GOIASA), porém **não fixam percentuais** — por exigência
> dos requisitos, os valores são **parametrizáveis** e vivem no anexo + nas regras
> de moderador. Único default fixo: **média de 6 meses** (configurável) para
> impossibilidade. Logo, o motor sai calibrado nas regras; os números entram pela
> configuração (multiempresa, sem hardcode).

- **Banco** (aditivo): 4 enums + 7 tabelas (`PrizeModeratorRule`,
  `PrizeManualAdjustment`, `PrizeException`, `PrizeTemporaryAllocation`,
  `PrizeCalculationRun`, `PrizeCalculationResult`, `PrizeCalculationLine`).
  Migração `20260609200000_prize_calc_engine`.
- **Motor PURO** (`prize-calc-engine.ts`, `computePrize`): etapas do procedimento
  (potencial → atingimento ponderado por faixa → resultado-base → proporcionalidade
  → indicadores individuais/comportamentais → bruto → moderadores → ajustes →
  exceções → teto/piso → arredondamento → final), com **memória de cálculo**
  (linhas auditáveis) e hash do processamento. Determinístico e 100% testado
  (`prize-calc-engine.spec.ts`, 10 cenários).
- **Orquestração** (`prize-calc.service.ts`): carrega snapshot elegível + anexo
  vigente (match por cargo/área) + indicadores + realizado + eventos + regras +
  ajustes/exceções aprovados; roda o motor por colaborador; persiste run/result/
  line. **Reprocesso versionado** (run anterior → SUPERSEDED, nunca sobrescreve);
  impossibilidade usa média histórica das competências anteriores.
- **Configuração e governança** (`prize-calc-config.service.ts`): moderadores
  (CRUD parametrizável), ajustes manuais e exceções com **fluxo de aprovação e
  segregação** (quem solicita não aprova o próprio ajuste), transitoriedade.
- **Frontend**: `/gestao-premio/apuracao` (rodar/reprocessar + resultados +
  **memória de cálculo** por colaborador) e `/gestao-premio/moderadores` (config).
- **Testes**: suíte total **274 verdes**. tsc verde (api+web).

## 0.1. Fase 3 — Base Elegível (Apdata) + Snapshot + Conciliação (entregue)

- **Banco** (aditivo): enums `PrizeConnectorType`, `PrizeJobStatus` + tabelas
  `PrizeIntegrationConfig`, `PrizeIntegrationJob`, `PrizeEmployeeSnapshot`,
  `PrizeEmployeeEvent`. Migração `20260609190000_prize_eligible`.
- **Conectores desacoplados** (`/gestao-premio/integracoes`): Apdata (base/eventos),
  Folha; tipos API/CSV/XLSX/banco/manual. **Segredos por referência**
  (`secretRef` = nome de env var/cofre) — nunca armazenados em claro; resposta
  redige a referência (`hasSecret`). Teste de conector valida credencial/endpoint
  sem expor valores. Sem conector real → **importação assistida por arquivo/mock**.
- **Base elegível** (`/gestao-premio/colaboradores`): import por competência com
  **snapshot imutável por lote** (`lotVersion`, `current`), **CPF mascarado**
  (`***.456.789-**`) e **salário protegido** por `prize:salary:view`. Eventos
  (faltas/atestados/medidas/acidentes/treinamento…) importados junto, alimentando
  proporcionalidade/moderadores da Fase 4.
- **Conciliação**: cada import compara o lote entrante com o corrente e reporta
  inclusões, exclusões, alterações (cargo/área/CC/situação/salário) e pendências
  (sem salário, sem cargo, desligados). Helper puro `reconcile`/`maskCpf` testado.
- **Permissão**: `prize:eligible:manage` (importar/conciliar); conectores sob
  `prize:admin`. **Checklist de fechamento**: item "base elegível" disponível.
- **Testes**: `prize-eligible.util.spec.ts` (masking, conciliação, mock).
- **Isolamento de trabalho**: esta fase foi desenvolvida em git **worktree**
  dedicada (`.claude/worktrees/gestao-premio`) no branch `feat/gestao-premio`,
  sem tocar no `main`.

## 0. Fase 2 — Lançamento do Realizado + Previsto × Realizado (entregue)

O Gestão 360 passa a ser a **fonte oficial do realizado**.

- **Banco** (aditivo): enum `PrizeActualStatus` + tabelas `PrizeActualResult` e
  `PrizeActualEvidence`. Migração `20260609180000_prize_actuals`. Realizado é
  único por `(competência, indicador, escopo, semana, dia)`.
- **Lançamento do Realizado** (`/gestao-premio/realizado`): grade editável por
  indicador/competência, salvamento em lote, validações (competência travada,
  indicador inativo, alteração de realizado em validação exige justificativa),
  status do realizado (`IN_FILLING → PENDING → IN_VALIDATION → PRE_CLOSE → CLOSED
  → REOPENED → CORRECTED`), **fechamento do realizado** (trava) e **reabertura
  controlada** (alçada `prize:actuals:close` + justificativa). Evidências por
  lançamento (API).
- **Previsto × Realizado** (`/gestao-premio/previsto-realizado`): por competência,
  compara meta/zero × realizado e calcula **desvio, % de atingimento e faixa
  alcançada** (helper puro `evaluateActual`, testado). Resumo (com realizado /
  sem realizado / fora da meta) e atalhos para Análise de Causa e Plano de Ação.
- **Checklist de fechamento** da competência agora valida **realizado completo**
  (item impeditivo real: nº de indicadores com realizado).
- **Testes**: `prize-evaluation.spec.ts` (6 casos de atingimento/faixa). Suíte
  total **257 verdes**.

---

## 1. Relatório executivo

### Cenário anterior
A apuração do prêmio dependia de controles paralelos: planilhas de resultados
e de apontamentos, SESuite, Helpdesk, Apdata, e-mails e validações manuais
(transitoriedade, gratificação de treinamento, conferência de indicadores). Isso
gerava divergências, retrabalho, atraso no fechamento, baixa rastreabilidade e
risco de pagamento incorreto — conforme o mapa do processo (BIZAGI "GESTÃO DE
PRÊMIO2") e a matriz de 25 requisitos (POC, indispensáveis).

### Solução implementada (Fase 1)
O Gestão 360 passa a ser a **fonte oficial e auditável** da governança do prêmio.
Nesta fase entregamos a fundação completa do módulo:

- **Programas de Prêmio**: cadastro parametrizável (periodicidade, moeda,
  arredondamento, prazos, rubrica, responsáveis, elegibilidade) com versionamento
  de configuração e duplicação.
- **Anexos e Regras com governança real**: versões, **workflow de aprovação**
  (rascunho → em elaboração → em validação → em aprovação → aprovado → vigente →
  substituído), **regra de versão única vigente por anexo/contexto**, bloqueio de
  edição de versão vigente, devolução/reprovação com comentário obrigatório,
  verificação de **sobreposição de vigência** e comparação entre versões.
- **Indicadores** coletivos, individuais e comportamentais com **metas, zeros,
  pesos e faixas variáveis por período**.
- **Competências** com máquina de estados, **checklist de fechamento** (itens
  impeditivos x alertas), **fechamento que trava alterações** e **reabertura
  controlada com justificativa obrigatória e alçada**.
- **Trilha de auditoria** imutável para toda ação crítica.
- **Painel executivo** (Visão Geral) com cards de governança e ciclo + atividade
  recente, e cards de apuração/folha já visíveis (preenchidos nas próximas fases).
- **Multiempresa**: isolamento por `companyId`; módulo `prize` no catálogo do
  Super Admin (liga/desliga por empresa); 19 permissões granulares com
  **segregação de função** (quem opera não aprova; salário é permissão separada).

### Telas criadas
`/gestao-premio` (Visão Geral), `/gestao-premio/programas`,
`/gestao-premio/competencias`, `/gestao-premio/anexos`,
`/gestao-premio/indicadores`.

### Ganhos esperados
Base única e versionada das regras; rastreabilidade ponta a ponta; redução de
divergências e retrabalho; fechamento com checklist; segregação de função e
conformidade (LGPD: salário sob permissão dedicada).

### Riscos / pendências
- Migração ainda **não aplicada** ao banco de produção (Neon) — requer
  autorização explícita (ver seção 5).
- Fases 2–7 (realizado, Apdata, motor de cálculo, moderadores, transitoriedade,
  folha, espelho PDF, relatórios) no backlog.

---

## 2. Relatório técnico

### Arquitetura
- **Backend** (`apps/api`, NestJS + Prisma): módulo `prize` registrado em
  `app.module.ts`. Controllers REST sob `/api/prize/*`, services com toda a regra
  de negócio (cálculos e workflow **no backend**, nunca no frontend).
- **Frontend** (`apps/web`, Next.js App Router): rotas em
  `app/(app)/gestao-premio/*`, react-query + `useAuth().hasPermission`.
- **Tenancy**: `companyId` escalar em todas as tabelas do módulo (mesmo padrão de
  `PlatformCompanyModule`). Relações **internas** ao módulo usam `@relation`;
  referências externas (User/OrgNode) são colunas escalares para não impactar os
  modelos compartilhados.

### Banco de dados (8 enums + 10 tabelas)
`PrizeProgram`, `PrizeProgramVersion`, `PrizeCompetence`, `PrizeAnnex`,
`PrizeAnnexVersion`, `PrizeAnnexApproval`, `PrizeIndicator`,
`PrizeIndicatorParameter`, `PrizeIndicatorRange`, `PrizeAuditLog`.
Enums: `PrizeProgramStatus`, `PrizePeriodicity`, `PrizeCompetenceStatus`,
`PrizeAnnexStatus`, `PrizeApprovalStatus`, `PrizeIndicatorKind`,
`PrizeIndicatorDirection`, `PrizeIndicatorSource`.

### Migração
`apps/api/prisma/migrations/20260609170000_prize_module_foundation/migration.sql`
— **aditiva e reversível**. Não altera nenhuma tabela existente (verificado: sem
DROP/ALTER em tabelas legadas). Cabeçalho documenta o rollback.

### APIs (resumo)
| Método | Rota | Permissão |
|---|---|---|
| GET | `/prize/overview` | `prize:view` |
| GET | `/prize/audit` | `prize:reports:view` |
| GET/POST/PATCH/DELETE | `/prize/programs[...]` | `prize:view` / `prize:programs:manage` |
| GET/POST/PATCH | `/prize/competences[...]` | `prize:view` / `prize:competences:manage` |
| POST | `/prize/competences/:id/close` | `prize:competences:close` |
| POST | `/prize/competences/:id/reopen` | `prize:competences:reopen` |
| GET/POST/PATCH | `/prize/annexes[...]` | `prize:view` / `prize:annex:manage` |
| POST | `/prize/annexes/versions/:id/submit` · `/send-approval` | `prize:annex:submit` |
| POST | `/prize/annexes/versions/:id/decide` · `/publish` | `prize:annex:approve` |
| GET/POST/PATCH/DELETE | `/prize/indicators[...]` (+ `/parameters`, `/ranges`) | `prize:view` / `prize:indicators:manage` |

### Permissões (19)
`prize:view`, `prize:programs:manage`, `prize:competences:manage|close|reopen`,
`prize:annex:manage|submit|approve`, `prize:indicators:manage`,
`prize:actuals:manage|close`, `prize:calc:run`,
`prize:adjustments:manage|approve`, `prize:payroll:manage`,
`prize:payslip:publish`, `prize:reports:view`, `prize:salary:view`,
`prize:admin`. SUPER_ADMIN/ADMIN recebem todas; GESTOR recebe um subconjunto
operacional **sem** aprovar/ver salário (segregação).

### Arquivos
**Criados (backend):** `modules/prize/` → `prize.module.ts`, `prize.controller.ts`,
`prize-audit.service.ts`, `prize-overview.service.ts`,
`prize-programs.{service,controller}.ts`,
`prize-competences.{service,controller}.ts`,
`prize-annexes.{service,controller}.ts`,
`prize-indicators.{service,controller}.ts`,
`prize-annexes.service.spec.ts`.
**Criados (frontend):** `app/(app)/gestao-premio/{,programas,competencias,anexos,indicadores}/page.tsx`.
**Alterados:** `prisma/schema.prisma`, `app.module.ts`,
`modules/users/permission-catalog.ts`,
`modules/portal-admin/portal-catalog.ts`,
`web/components/shell/navigation.ts`.

### Testes
`prize-annexes.service.spec.ts` (5 casos): versão única vigente ao publicar;
bloqueio de publicar não-aprovada; bloqueio de editar versão vigente; fluxo
completo submit→aprovação→publicação; devolução exige comentário.
**Suíte total: 251 testes verdes.** `tsc --noEmit` verde em `apps/api` e `apps/web`.

### Deploy / rollback
- `npx prisma generate` já executado (atualiza o client, não toca o banco).
- Para aplicar em produção: `pnpm --filter @g360/api prisma:deploy` (após
  autorização — ver seção 5).
- Rollback: cabeçalho da migration tem o `DROP TABLE/TYPE` correspondente.

---

## 3. Mapa funcional (ciclo do prêmio)

```text
Programa → Anexo → Aprovação → Indicadores → Metas → Realizado → Fechamento
→ Base Elegível → Eventos → Transitoriedade → Ajustes → Exceções → Cálculo
→ Conferência → Aprovação → Folha → Espelho → Auditoria
```

Legenda Fase 1: **implementado** = Programa, Anexo, Aprovação, Indicadores, Metas,
Fechamento (checklist/trava/reabertura), Auditoria. **Próximas fases** = Realizado,
Base Elegível (Apdata), Eventos, Transitoriedade, Ajustes, Exceções, Cálculo,
Conferência, Folha, Espelho.

---

## 4. Máquinas de estado

**Anexo (versão):** `DRAFT → IN_ELABORATION → IN_VALIDATION → IN_APPROVAL →
APPROVED → EFFECTIVE → SUPERSEDED → ARCHIVED`. Publicar exige `APPROVED`; ao
publicar, a versão vigente anterior vira `SUPERSEDED` (versão única vigente).

**Competência:** `PLANNED → OPEN → FILLING → IN_VALIDATION → PRE_CLOSE →
CLOSED_FOR_CALC → IN_CALCULATION → IN_REVIEW → IN_APPROVAL → APPROVED →
SENT_TO_PAYROLL → PAYSLIPS_PUBLISHED → CLOSED`. A partir de `CLOSED_FOR_CALC` a
competência fica **travada**; reabrir exige `prize:competences:reopen` +
justificativa.

---

## 5. Ações manuais pendentes (segurança)

1. **Aplicar a migração no banco de produção (Neon)** — requer autorização
   explícita do responsável. Comando: `prisma migrate deploy` no ambiente alvo.
   O `.env` da API aponta para o Neon de produção; **não** foi aplicada
   automaticamente.
2. **Sincronizar o catálogo de módulos / permissões** no ambiente (o bootstrap de
   permissões e o sync do catálogo do portal são aditivos por `code`).

---

## 6. Segurança e LGPD

- Autorização **no backend** em todas as rotas (`@RequirePermissions`).
- Isolamento por empresa (`companyId`) em todas as consultas.
- Dados salariais e valores individuais sob permissão dedicada
  `prize:salary:view` (não concedida ao GESTOR por padrão).
- Segregação de função: aprovação de anexos/ajustes e reabertura de competência
  são permissões separadas da operação.
- Trilha de auditoria imutável (`PrizeAuditLog`) — sem update/delete por telas.

---

## 7. Backlog residual

### Parcialmente concluído / fundação pronta
- Dashboard com drill-down completo e gráficos (cards prontos; gráficos pendentes).
- Wizard de criação de anexo em 12 passos (CRUD/governança pronta; wizard pendente).
- Realizado: lançamento manual + grade prontos; **importação em massa (XLSX/CSV)**
  e UI de evidências pendentes (API de evidência já existe).
- Tendência e impacto financeiro no Previsto × Realizado (dependem de histórico e
  do Motor de Cálculo da Fase 4).
- Fase 4 (inc. 2 concluída): telas dedicadas de **ajustes/exceções/transitoriedade**
  (`/gestao-premio/ajustes`, com abas) e **workflow de conferência** da apuração
  (enviar p/ conferência → aprovar/reprovar, com segregação: quem roda não aprova)
  já entregues. Pendência residual: notificações automáticas da conferência.

### Residual (refinamentos — não impeditivos)
- Importação **XLSX/CSV** pela UI: **despriorizada por decisão de produto** —
  o fluxo padrão é lançamento na plataforma + push por API (seção 0.6); arquivo
  fica como contingência via API (`rows` parseadas) se um dia for necessário.
- **Notificações automáticas** (§26) por e-mail/sistema dos eventos do ciclo
  (DESEJÁVEL na matriz; trilha de auditoria já cobre o registro).
- Transitoriedade **multi-segmento** com re-apuração por indicadores da área de
  destino (hoje: registro por dias + direito sim/não + proporcional + trilha).
- Painel **dedicado** do módulo no Super Admin com métricas de consumo (hoje:
  habilitar/bloquear por empresa + planos via Portal Admin Global).
- Wizard de anexo em 12 passos e UI de evidências (CRUD/API prontos).

### Depende de credencial / regra externa
- Endpoints/credenciais reais do Apdata e da Folha (até lá: importação assistida
  por arquivo + mocks documentados — sem simular integração real).
- Percentuais e critérios específicos de moderadores/faixas (parametrizáveis —
  não fixados em código).

---

## 8. Conformidade (vs. documentos `Gestao_premio` e prompt de 38 seções)

Conferência dos 36 critérios de aceite (§36 do prompt) e dos 25 requisitos
indispensáveis (matriz POC). **Legenda:** ✓ atendido · ◐ atendido com refinamento
residual.

| # | Critério de aceite | Status | Onde |
|---|---|---|---|
| 1 | Módulo integrado ao Gestão 360 | ✓ | menu, RBAC, catálogo |
| 2 | Menu e navegação completos | ✓ | seção "Gestão de Prêmio" (18 telas) |
| 3 | Empresas isoladas | ✓ | `companyId` em todas as queries |
| 4 | Anexos com workflow e versões | ✓ | Fase 1 |
| 5 | Uma versão vigente por contexto | ✓ | publish supersede + overlap |
| 6 | Metas/zeros/faixas/pesos parametrizáveis | ✓ | Indicadores |
| 7 | Realizado lançado e importado | ◐ | manual+grade ✓; import XLSX UI residual |
| 8 | Realizado fechado bloqueado | ✓ | Fase 2 |
| 9 | Reabertura com justificativa e alçada | ✓ | Fases 2/4 |
| 10 | Competência com checklist | ✓ | Fase 1/2 |
| 11 | Apdata com adaptador | ✓ | conectores (mock/arquivo) |
| 12 | Importação manual de contingência | ✓ | Fase 3 |
| 13 | Snapshot por competência | ✓ | `PrizeEmployeeSnapshot` (lote) |
| 14 | Divergências conciliáveis | ✓ | `reconcile` |
| 15 | Motor versionado | ✓ | `PrizeCalculationRun` (SUPERSEDED) |
| 16 | Memória de cálculo | ✓ | `PrizeCalculationLine` |
| 17 | Moderadores aplicados | ✓ | regras parametrizáveis |
| 18 | Transitoriedade funcional | ◐ | dias+direito+proporcional+trilha; multi-segmento residual |
| 19 | Ajustes manuais auditados | ✓ | aprovação+segregação |
| 20 | Exceções tratadas | ✓ | impossibilidade/treinamento/desligamento |
| 21 | Treinamento contemplado | ✓ | engine (gratificação) |
| 22 | Desligamentos tratados | ✓ | engine (proporcional) |
| 23 | Saída para folha | ✓ | Fase 5 |
| 24 | Retorno conciliado | ✓ | Fase 5 |
| 25 | PDF do espelho | ✓ | Fase 6 (jsPDF) |
| 26 | Relatórios | ✓ | Fase 7 |
| 27 | Trilha de auditoria | ✓ | `PrizeAuditLog` + tela |
| 28 | Alertas | ◐ | trilha ✓; notificações automáticas residual (DESEJÁVEL) |
| 29 | Permissões granulares | ✓ | 22 chaves `prize:*` |
| 30 | Segregação de função | ✓ | anexo/ajuste/conferência |
| 31 | Salário não exposto | ✓ | `prize:salary:view` |
| 32 | Testes documentados | ✓ | 280 testes (engine, governança, conciliação, folha) |
| 33 | Documentação técnica | ✓ | este documento |
| 34 | Migrations seguras | ✓ | 6 migrações aditivas/reversíveis |
| 35 | Funcionalidades existentes intactas | ✓ | suíte completa verde; worktree isolada |
