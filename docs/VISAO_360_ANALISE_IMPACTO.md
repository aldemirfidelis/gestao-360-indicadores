# Visão 360° do Registro e Central de Impactos

Este documento detalha a arquitetura, o funcionamento técnico e os fluxos de integração da funcionalidade **Visão 360° do Registro** e da **Central de Impactos** no sistema **Gestão 360**.

---

## 1. Visão Geral

A **Visão 360° do Registro** é uma camada transversal de análise de impacto e rastreabilidade corporativa. Ela conecta diferentes entidades do sistema (Indicadores, Processos, Documentos, Riscos, Auditorias, Não Conformidades, Reuniões, Planos de Ação, Projetos e Desvios) em um grafo em tempo de execução, permitindo que os usuários compreendam a interdependência de suas ações e decisões.

### Principais Características
- **Retractable Sidebar Panel (Painel Lateral Retrátil):** Acessível em qualquer tela de visualização de registro através de um botão flutuante ou de atalho.
- **Rastreabilidade Bidirecional:** Identifica tanto de onde o registro provém quanto o que ele afeta.
- **Isolamento Multitenant Estrito:** Todos os dados, logs de auditoria e caminhos de relacionamento são filtrados pelo `companyId` do token de autenticação.
- **Segurança Fina:** Se o usuário não possuir acesso a um registro relacionado, o sistema oculta seus detalhes confidenciais e exibe a mensagem: *"Registro relacionado com acesso restrito"*.
- **BFS Limitado (Profundidade Máxima = 3):** Simula os impactos indiretos propagados pela estrutura sem perigo de loops infinitos ou sobrecarga de performance.

---

## 2. Modelagem de Banco de Dados (Prisma Schema)

Os relacionamentos manuais, as simulações e auditorias são mantidos por quatro tabelas dedicadas:

```prisma
// Relacionamentos Manuais Estabelecidos
model RelationshipLink {
  id                 String    @id @default(uuid())
  companyId          String
  sourceEntityType   String    // ex: "INDICATOR", "PROCESS"
  sourceEntityId     String
  targetEntityType   String
  targetEntityId     String
  relationshipType   String    // ex: "pertence_a", "depende_de", "atende"
  direction          String    @default("DIRECT") // DIRECT | INDIRECT
  criticality        String    @default("MEDIUM") // CRITICAL | HIGH | MEDIUM | LOW | INFO
  isMandatory        Boolean   @default(false)
  originType         String    @default("MANUAL") // AUTOMATIC | MANUAL
  notes              String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  deletedAt          DateTime? // Exclusão lógica
  createdById        String?

  company            Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdBy          User?     @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([companyId])
  @@index([sourceEntityType, sourceEntityId])
  @@index([targetEntityType, targetEntityId])
}

// Histórico Mestre de Alterações de Impacto
model ImpactAnalysis {
  id                   String               @id @default(uuid())
  companyId            String
  sourceEntityType     String
  sourceEntityId       String
  operationType        String               // "UPDATE" | "DELETE" | "INACTIVE"
  changeSummary        String
  previousValues       String?              // JSON string
  newValues            String?              // JSON string
  impactLevel          String               // "CRITICAL" | "HIGH" | "MEDIUM"
  affectedRecordsCount Int
  justification        String?
  status               String               @default("PENDING") // PENDING | COMPLETED | APPROVED
  createdAt            DateTime             @default(now())
  createdById          String?

  company              Company              @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdBy            User?                @relation(fields: [createdById], references: [id], onDelete: SetNull)
  items                ImpactAnalysisItem[]

  @@index([companyId])
}

// Itens Afetados por uma Alteração (Pendências na Central de Impactos)
model ImpactAnalysisItem {
  id                String         @id @default(uuid())
  companyId         String
  impactAnalysisId  String
  affectedEntityType String
  affectedEntityId  String
  relationshipPath  String         // ex: "INDICATOR ➔ PROCESS ➔ DOCUMENT"
  impactReason      String
  impactLevel       String
  recommendedAction String?
  requiresReview    Boolean        @default(false)
  requiresTask      Boolean        @default(false)
  responsibleUserId String?
  dueDate           DateTime?
  status            String         @default("PENDING") // PENDING | RESOLVED
  resolvedAt        DateTime?
  resolvedById      String?
  createdAt         DateTime       @default(now())

  impactAnalysis    ImpactAnalysis @relation(fields: [impactAnalysisId], references: [id], onDelete: Cascade)
  responsibleUser   User?          @relation(fields: [responsibleUserId], references: [id], onDelete: SetNull)

  @@index([companyId])
  @@index([impactAnalysisId])
}

// Trilha de Auditoria das Relações
model RelationshipAuditLog {
  id             String   @id @default(uuid())
  companyId      String
  entityType     String
  entityId       String
  eventType      String   // "LINK_CREATED" | "LINK_REMOVED" | "IMPACT_SIMULATED"
  previousValues String?
  newValues      String?
  performedById  String?
  notes          String?
  createdAt      DateTime @default(now())

  company        Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  performedBy    User?    @relation(fields: [performedById], references: [id], onDelete: SetNull)

  @@index([companyId])
}
```

---

## 3. Arquitetura do Motor de Impacto (BFS)

O método `simulateImpact` no `Vision360Service` executa uma busca em largura (BFS) a partir de um nó inicial:

1. **Enfileiramento Inicial:** O registro de origem é enfileirado com `depth = 0`.
2. **Varredura de Relações:** O BFS resolve e mescla tanto vínculos **automáticos** (ex: processos calculados por um indicador, desvios originados de um indicador) quanto os vínculos **manuais** (cadastrados via RelationshipLink).
3. **Controle de Loop e Ciclo:** Um conjunto `visited` impede a re-visita de nós, cortando ciclos infinitos.
4. **Limite de Profundidade:** A recursão para ao atingir `depth = 3`, mantendo a simulação restrita ao escopo útil.
5. **Enriquecimento:** Para cada item visitado, são extraídos seu nome corporativo, código, status de farol e seu responsável direto.

---

## 4. Endpoints da API REST (`Vision360Controller`)

Todas as rotas estão sob o prefixo `/api/vision360` e exigem autenticação do JWT bearer token:

| Rota | Método | Permissão Necessária | Descrição |
|---|---|---|---|
| `/links` | `GET` | `vision360:view` | Retorna o resumo da entidade, os breadcrumbs organizacionais e a lista de vínculos mesclados (auto + manual). |
| `/links` | `POST` | `vision360:manage` | Cria um relacionamento manual entre duas entidades da mesma empresa. |
| `/links/:id` | `DELETE` | `vision360:manage` | Arquiva logicamente um vínculo manual. |
| `/impact-simulation` | `GET` | `vision360:impact` | Simula todos os impactos em cascata a partir do ID fornecido. |
| `/impact-analysis` | `POST` | `vision360:impact` | Salva uma análise de impacto master, gerando planos de ação e notificações para os responsáveis. |
| `/pending-impacts` | `GET` | `vision360:impact` | Retorna a lista de itens pendentes de revisão atribuídos à empresa do usuário. |
| `/impact-items/:id/resolve` | `PATCH` | `vision360:impact` | Resolve uma pendência de impacto registrada. |
| `/export-xlsx` | `GET` | `vision360:view` | Exporta a planilha Excel `.xlsx` contendo o relatório de impacto e rastreabilidade. |

---

## 5. Fluxo de Trabalho no Frontend Web

### A. Painel Lateral (Sidebar 360°)
O painel lateral possui **16 acordeons integrados**, organizando os vínculos por suas respectivas áreas de atuação (Indicadores, Riscos, Documentos GED, Treinamentos, Reuniões, etc.). Ele mantém uma pilha de histórico local, permitindo ao usuário navegar nos detalhes sem perder a tela de fundo atual.

### B. Interceptação de Formulários (Simulation Modal)
Quando um usuário tenta **atualizar** ou **excluir** um Indicador, Processo ou Documento:
1. O formulário intercepta o clique do botão "Salvar" ou "Excluir".
2. Um modal exibe em tempo real a simulação de impacto corporativo obtida via `GET /impact-simulation`.
3. Para cada registro impactado de criticidade alta/crítica, o usuário pode configurar:
   - Uma tarefa de revisão recomendada.
   - Atribuir a tarefa a um responsável específico e setar um prazo de adequação.
   - Decidir se cria um plano de ação (ActionPlan) ou exige apenas a revisão.
4. O usuário digita obrigatoriamente a justificativa.
5. Ao confirmar, o sistema persiste a análise (`POST /impact-analysis`) e submete a edição/exclusão original.

### C. Central de Impactos (`/central-impactos`)
Consiste em um dashboard onde gestores revisam pendências geradas por mudanças no sistema. Exibe as tarefas em andamento, as resoluções de impacto realizadas e estatísticas globais da empresa.
