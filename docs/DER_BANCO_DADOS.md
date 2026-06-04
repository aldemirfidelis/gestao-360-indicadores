# DER do banco de dados

Documento textual do modelo relacional do Gestão 360. Fonte principal: `apps/api/prisma/schema.prisma`.

## Status

- Data da consolidação: 2026-06-04.
- Total de migrations no repositório: 34.
- Aplicadas no Neon durante a conferência: 31.
- Pendentes no Neon, aguardando autorização: `20260604160000_audit_compliance`, `20260604170000_process_sipoc`, `20260604180000_forms_checklists`.

## Convenções do modelo

- `Company` é o tenant raiz. Registros operacionais carregam `companyId` no agregado principal.
- Filhos herdam escopo pela relação com o pai. Exemplos: `IndicatorResult` herda empresa de `Indicator`; `AuditFinding` herda empresa de `Audit`; `FormAnswer` herda empresa de `FormSubmission`.
- A maioria dos agregados usa exclusão lógica por `deletedAt`.
- Sequenciais por empresa usam `number` com `@@unique([companyId, number])`.
- O escopo por área usa `OrgNode` e é aplicado na API pelo `AccessService`.

## Entidades centrais

| Entidade | Papel | Relações principais |
| --- | --- | --- |
| `Company` | Tenant/empresa | Usuários, áreas, indicadores, ações, projetos, módulos FASE 6, auditoria e parametrizações |
| `Branch` | Unidade/filial | Pertence a `Company`, contém `OrgNode`, usuários e ações |
| `OrgNode` | Área, setor, processo ou nó organizacional | Árvore por `parentId`; vincula indicadores, ações, riscos, NCs, documentos, auditorias, processos e formulários |
| `User` | Usuário autenticado | Empresa, filial, área padrão, permissões, atribuições de área e eventos de auditoria |
| `UserPermission` | Permissão direta por usuário | Chaves `module:action` usadas pelos guards |

## Segurança, acesso e auditoria

| Entidade | Papel |
| --- | --- |
| `UserAreaAssignment` | Áreas atribuídas a um usuário, com tipo e validade |
| `AreaVisibilityRule` | Matriz de visibilidade origem -> destino por módulo/ação |
| `UserVisibilityException` | Exceções individuais ALLOW/DENY por área e módulo |
| `AuditLog` | Auditoria de operações, incluindo negações do `AccessService` |
| `StatusHistory` | Histórico de mudança de status por entidade |

## Fluxo principal de gestão

| Entidade | Papel | Relações principais |
| --- | --- | --- |
| `Indicator` | KPI/indicador | Empresa, área dona, responsável, objetivo estratégico, metas, resultados, desvios, reuniões, ações e rastreabilidade |
| `IndicatorTarget` | Meta por período | Filho de `Indicator` |
| `IndicatorResult` | Resultado realizado por período | Filho de `Indicator`; pode gerar tratativas e ações |
| `Deviation` | Desvio/FCA/CAPA de indicador fora da meta | Empresa, indicador, causas, análises, reuniões, ações e NCs |
| `DeviationCause` | Causa do desvio | Filho de `Deviation` |
| `DeviationAnalysis` | Análise estruturada do desvio | Filho de `Deviation`; pode originar reunião e ação |
| `ActionPlan` | Plano de ação | Empresa, área, indicador, desvio, reunião, análise, tarefas, evidências, participantes e eficácia |
| `ActionTask` | Tarefa do plano | Filho de `ActionPlan` |
| `ActionEvidence` | Evidência de ação/tarefa | Filho de `ActionPlan` e opcionalmente de `ActionTask` |
| `Meeting` | Reunião | Empresa, indicador/desvio/análise/tratativa, participantes, decisões, convites e minuta |
| `TraceabilityEvent` | Linha do tempo corporativa | Empresa, indicador opcional, entidade origem e entidade relacionada |

## Estratégia, OKR e PMO

| Entidade | Papel |
| --- | --- |
| `StrategicMap`, `Perspective`, `StrategicObjective` | Mapa estratégico e objetivos |
| `ObjectiveRelation` | Ligações entre objetivos |
| `StrategicObjectiveIndicator`, `StrategicObjectiveOrgNode` | Vínculos de objetivo com indicadores e áreas |
| `OKRCycle`, `Objective`, `KeyResult` | Ciclos de OKR, objetivos e resultados-chave |
| `Project`, `ProjectMilestone`, `ProjectTask` | PMO, marcos, tarefas, dependências e vínculo opcional com indicador |

## Módulos corporativos FASE 6

| Entidade | Papel | Relações principais |
| --- | --- | --- |
| `RiskRegister` | Registro de riscos e oportunidades | Empresa, área, indicador, projeto, ação de mitigação, responsável |
| `NonConformity` | Não conformidade/CAPA | Empresa, número, área, indicador, desvio, ação corretiva, constatações de auditoria |
| `Document` | Gestão documental | Empresa, número/código, área, indicador, dono, aprovador, ciclo de vida e validade |
| `Audit` | Auditoria/compliance | Empresa, número, área, auditor líder e constatações |
| `AuditFinding` | Constatação de auditoria | Filho de `Audit`; pode vincular ou gerar `NonConformity` |
| `Process` | Processo/SIPOC | Empresa, número/código, área, indicador, dono, fornecedores, entradas, saídas, clientes |
| `ProcessStep` | Etapa do processo | Filho de `Process` |
| `FormTemplate` | Template de formulário/checklist | Empresa, número, área, processo, indicador, campos e submissões |
| `FormField` | Campo configurável | Filho de `FormTemplate` |
| `FormSubmission` | Preenchimento de formulário/checklist | Empresa, template, área, processo, indicador, respostas e revisão |
| `FormAnswer` | Resposta de campo | Filho de `FormSubmission`, com snapshot do label do campo |

## Administração e suporte

| Entidade | Papel |
| --- | --- |
| `PortalAdminAuditLog` | Auditoria da Central de Administração do Portal |
| `DbAdminAuditLog` | Auditoria da administração de banco |
| `ImportJob` | Importações e cargas |
| `Notification` | Notificações |
| `Conversation`, `Message`, `MessageAttachment` | Comunicação interna |
| `ExternalIntegration`, `UserIntegrationPreference` | Integrações externas e preferências por usuário |

## Observações de produção

- O DER lógico está completo no schema, mas as tabelas de Auditorias, Processos/SIPOC e Formulários/Checklists só existirão no Neon depois do deploy autorizado das três migrations pendentes.
- Não aplicar migrations em banco compartilhado para testes exploratórios. Usar banco local/isolado quando os fluxos E2E operacionais forem expandidos.
