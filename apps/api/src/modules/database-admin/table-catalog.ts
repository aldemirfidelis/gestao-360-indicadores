export interface TableCatalogEntry {
  module: string;
  moduleKey: string;
  label: string;
  origin: string;
  purpose: string;
  impact: string;
}

type CatalogSeed = Omit<TableCatalogEntry, 'label'> & { label?: string };

const EXACT_CATALOG: Record<string, CatalogSeed> = {
  Company: {
    module: 'Organização',
    moduleKey: 'organization',
    label: 'Empresas',
    origin: 'Cadastro base da plataforma',
    purpose: 'Guarda as empresas/tenants que usam o sistema.',
    impact: 'Afeta login, permissões, dados por empresa, filiais e quase todos os módulos operacionais.',
  },
  Branch: {
    module: 'Organização',
    moduleKey: 'organization',
    label: 'Filiais',
    origin: 'Cadastro organizacional',
    purpose: 'Representa unidades, plantas ou filiais de uma empresa.',
    impact: 'Impacta segmentação de usuários, indicadores, documentos, auditorias e registros operacionais.',
  },
  OrgNode: {
    module: 'Organização',
    moduleKey: 'organization',
    label: 'Áreas e setores',
    origin: 'Estrutura organizacional',
    purpose: 'Mantém a hierarquia de áreas, setores e centros organizacionais.',
    impact: 'Afeta visibilidade, responsáveis, indicadores, documentos, planos de ação e relatórios.',
  },
  WorkPeriod: {
    module: 'Organização',
    moduleKey: 'organization',
    label: 'Períodos de trabalho',
    origin: 'Cadastro operacional',
    purpose: 'Define turnos ou períodos usados nas rotinas da empresa.',
    impact: 'Impacta apontamentos, operação, segurança patrimonial e análises por turno.',
  },
  User: {
    module: 'Acesso e permissões',
    moduleKey: 'access',
    label: 'Usuários',
    origin: 'Gestão de usuários',
    purpose: 'Guarda contas, perfis de acesso e dados de autenticação dos usuários.',
    impact: 'Afeta login, auditoria, responsáveis, aprovações, visibilidade e todas as operações por usuário.',
  },
  Permission: {
    module: 'Acesso e permissões',
    moduleKey: 'access',
    label: 'Permissões',
    origin: 'Catálogo de segurança',
    purpose: 'Lista permissões disponíveis no sistema.',
    impact: 'Impacta liberação de telas, ações sensíveis e controles do portal administrativo.',
  },
  UserPermission: {
    module: 'Acesso e permissões',
    moduleKey: 'access',
    label: 'Permissões por usuário',
    origin: 'Gestão de usuários',
    purpose: 'Relaciona usuários diretamente a permissões.',
    impact: 'Impacta o que cada usuário consegue visualizar, criar, editar ou excluir.',
  },
  AccessProfile: {
    module: 'Acesso e permissões',
    moduleKey: 'access',
    label: 'Perfis de acesso',
    origin: 'Gestão de perfis',
    purpose: 'Define perfis reutilizáveis de acesso.',
    impact: 'Impacta atribuição padronizada de permissões e governança de acesso.',
  },
  ProfilePermission: {
    module: 'Acesso e permissões',
    moduleKey: 'access',
    label: 'Permissões por perfil',
    origin: 'Gestão de perfis',
    purpose: 'Relaciona perfis de acesso com permissões.',
    impact: 'Impacta todos os usuários vinculados aos perfis alterados.',
  },
  RefreshToken: {
    module: 'Acesso e permissões',
    moduleKey: 'access',
    label: 'Sessões e tokens',
    origin: 'Autenticação',
    purpose: 'Controla tokens usados para renovar sessões.',
    impact: 'Impacta permanência de login, revogação de acesso e segurança de sessões.',
  },
  AppSetting: {
    module: 'Configurações',
    moduleKey: 'settings',
    label: 'Configurações do sistema',
    origin: 'Parâmetros globais',
    purpose: 'Armazena configurações persistidas da aplicação.',
    impact: 'Impacta comportamento global, limites, toggles e ajustes administrativos.',
  },
  DbAdminAuditLog: {
    module: 'Administração do banco',
    moduleKey: 'database-admin',
    label: 'Auditoria do banco',
    origin: 'Portal administrativo global',
    purpose: 'Registra ações feitas nas ferramentas de administração do banco.',
    impact: 'Impacta rastreabilidade, investigação de incidentes e governança técnica.',
  },
  DbAdminBackup: {
    module: 'Administração do banco',
    moduleKey: 'database-admin',
    label: 'Backups lógicos',
    origin: 'Portal administrativo global',
    purpose: 'Guarda metadados de snapshots e backups feitos pelo admin do banco.',
    impact: 'Impacta restauração preventiva e segurança antes de operações destrutivas.',
  },
  AuditLog: {
    module: 'Auditoria técnica',
    moduleKey: 'technical-audit',
    label: 'Logs de auditoria',
    origin: 'Auditoria da aplicação',
    purpose: 'Registra eventos técnicos e funcionais relevantes.',
    impact: 'Impacta rastreabilidade, conformidade, investigação e suporte.',
  },
};

const PREFIX_CATALOG: Array<{ prefix: string; seed: CatalogSeed }> = [
  {
    prefix: 'Security',
    seed: {
      module: 'Segurança patrimonial',
      moduleKey: 'security',
      origin: 'Módulo Segurança Patrimonial',
      purpose: 'Sustenta cadastros, autorizações, movimentações, rondas, ocorrências e auditoria da portaria.',
      impact: 'Impacta controle de acesso físico, pessoas, veículos, materiais, bloqueios, incidentes e registros da operação.',
    },
  },
  {
    prefix: 'Prize',
    seed: {
      module: 'Gestão Prêmio',
      moduleKey: 'prize',
      origin: 'Módulo Gestão Prêmio',
      purpose: 'Armazena programas, competências, anexos, regras, resultados e cálculos de premiação.',
      impact: 'Impacta apuração de prêmios, espelhos, integrações, folhas e auditoria de resultados.',
    },
  },
  {
    prefix: 'FoodSafety',
    seed: {
      module: 'Segurança de alimentos',
      moduleKey: 'food-safety',
      origin: 'Módulo Segurança de Alimentos',
      purpose: 'Mantém programas, processos, perigos, controles, fornecedores, lotes, rastreabilidade e recalls.',
      impact: 'Impacta HACCP, planos de controle, cadeia de suprimentos, conformidade e resposta a recalls.',
    },
  },
  {
    prefix: 'Document',
    seed: {
      module: 'Documentos',
      moduleKey: 'documents',
      origin: 'Módulo Documentos',
      purpose: 'Controla documentos, versões, arquivos, workflows, permissões, leituras e auditoria documental.',
      impact: 'Impacta gestão documental, aprovação, distribuição, revisão, retenção e evidências de leitura.',
    },
  },
  {
    prefix: 'Audit',
    seed: {
      module: 'Auditorias',
      moduleKey: 'audits',
      origin: 'Módulo Auditorias',
      purpose: 'Gerencia programas, planos, checklists, evidências, achados, relatórios e follow-up de auditoria.',
      impact: 'Impacta conformidade, avaliação de riscos, planos de ação, evidências e relatórios de auditoria.',
    },
  },
  {
    prefix: 'Form',
    seed: {
      module: 'Formulários',
      moduleKey: 'forms',
      origin: 'Módulo Formulários',
      purpose: 'Armazena modelos, campos, execuções, respostas, evidências, assinaturas e aprovações de formulários.',
      impact: 'Impacta registros operacionais, coletas, checklists, workflow, histórico e indicadores baseados em formulários.',
    },
  },
  {
    prefix: 'Workflow',
    seed: {
      module: 'Workflows',
      moduleKey: 'workflows',
      origin: 'Motor de workflows',
      purpose: 'Define fluxos, versões, nos, execuções, tarefas, eventos, timers e integrações.',
      impact: 'Impacta automações, aprovações, filas de trabalho, prazos e rastreabilidade de processos.',
    },
  },
  {
    prefix: 'Platform',
    seed: {
      module: 'Portal administrativo global',
      moduleKey: 'platform-admin',
      origin: 'Portal administrativo global',
      purpose: 'Controla usuários globais, planos, módulos, empresas, contratos, releases, backups e saúde da plataforma.',
      impact: 'Impacta administração multiempresa, liberação de módulos, suporte, faturamento e operação da plataforma.',
    },
  },
  {
    prefix: 'Portal',
    seed: {
      module: 'Catálogo do portal',
      moduleKey: 'portal',
      origin: 'Catálogo de navegação e features',
      purpose: 'Mantém módulos, páginas, funcionalidades, flags, regras de escopo e comunicados do portal.',
      impact: 'Impacta menus, rotas, disponibilidade de recursos, manutenções e comunicação interna.',
    },
  },
  {
    prefix: 'Compensation',
    seed: {
      module: 'Cargos e salários',
      moduleKey: 'compensation',
      origin: 'Módulo Cargos e Salários',
      purpose: 'Gerencia catálogo de cargos, descrições, tabelas salariais, enquadramentos, movimentos e orçamentos.',
      impact: 'Impacta estrutura salarial, aprovações, simulações, budget e histórico de alocações.',
    },
  },
  {
    prefix: 'Org',
    seed: {
      module: 'Organização',
      moduleKey: 'organization',
      origin: 'Estrutura organizacional',
      purpose: 'Mantém cargos, colaboradores, trilhas, aprovações e atribuições organizacionais.',
      impact: 'Impacta hierarquia, responsáveis, cargos e visibilidade de dados por área.',
    },
  },
  {
    prefix: 'Indicator',
    seed: {
      module: 'Indicadores',
      moduleKey: 'indicators',
      origin: 'Módulo Indicadores',
      purpose: 'Guarda indicadores, metas, resultados, anexos, comentários e relações entre indicadores.',
      impact: 'Impacta dashboards, análises de performance, fechamento mensal e planos de ação.',
    },
  },
  {
    prefix: 'Strategic',
    seed: {
      module: 'Estratégia e OKRs',
      moduleKey: 'strategy',
      origin: 'Módulo Estratégia',
      purpose: 'Armazena mapas, perspectivas, objetivos, versões e vínculos estratégicos.',
      impact: 'Impacta mapa estratégico, alinhamento de indicadores, OKRs e relatórios executivos.',
    },
  },
  {
    prefix: 'OKR',
    seed: {
      module: 'Estratégia e OKRs',
      moduleKey: 'strategy',
      origin: 'Módulo OKR',
      purpose: 'Controla ciclos, objetivos, resultados-chave e check-ins de OKR.',
      impact: 'Impacta acompanhamento de metas, progresso e alinhamento estratégico.',
    },
  },
  {
    prefix: 'Action',
    seed: {
      module: 'Planos de ação',
      moduleKey: 'actions',
      origin: 'Módulo Planos de Ação',
      purpose: 'Gerencia planos, tarefas, participantes, evidências, comentários, histórico e análises estruturadas.',
      impact: 'Impacta tratativas, prazos, responsabilidades, MASP/PDCA/5W2H e acompanhamento de desvios.',
    },
  },
  {
    prefix: 'Project',
    seed: {
      module: 'Projetos',
      moduleKey: 'projects',
      origin: 'Módulo Projetos',
      purpose: 'Armazena projetos, marcos e tarefas.',
      impact: 'Impacta planejamento, execução, prazos e acompanhamento de iniciativas.',
    },
  },
  {
    prefix: 'Risk',
    seed: {
      module: 'Riscos',
      moduleKey: 'risks',
      origin: 'Módulo Riscos',
      purpose: 'Mantém registros de riscos e seus atributos de avaliação.',
      impact: 'Impacta priorização, controles, planos de mitigação e visão de risco corporativo.',
    },
  },
  {
    prefix: 'Process',
    seed: {
      module: 'Processos',
      moduleKey: 'processes',
      origin: 'Módulo Processos',
      purpose: 'Modela processos, etapas e informações associadas.',
      impact: 'Impacta gestão por processos, formulários, riscos, auditorias e indicadores relacionados.',
    },
  },
  {
    prefix: 'Meeting',
    seed: {
      module: 'Reuniões',
      moduleKey: 'meetings',
      origin: 'Módulo Reuniões',
      purpose: 'Armazena reuniões, participantes, convidados, pautas e decisões.',
      impact: 'Impacta governança de decisões, atas, pendências e acompanhamento de compromissos.',
    },
  },
  {
    prefix: 'Message',
    seed: {
      module: 'Comunicação',
      moduleKey: 'communication',
      origin: 'Mensageria interna',
      purpose: 'Armazena mensagens, anexos e reações.',
      impact: 'Impacta comunicação interna, notificações e histórico de conversas.',
    },
  },
  // --- Módulos mais recentes (tabelas físicas em snake_case via @@map) ---
  {
    prefix: 'recruit_',
    seed: {
      module: 'Recrutamento e Seleção',
      moduleKey: 'recruitment',
      origin: 'Módulo Recrutamento e Seleção',
      purpose: 'Sustenta requisições de vaga, vagas, candidatos, etapas, avaliações, propostas, pré-admissão e admissão.',
      impact: 'Impacta o funil de contratação, aprovações de vaga, portal de carreiras e a admissão integrada ao DP.',
    },
  },
  {
    prefix: 'payroll_',
    seed: {
      module: 'Folha de Pagamento',
      moduleKey: 'payroll',
      origin: 'Módulo Folha de Pagamento',
      purpose: 'Guarda competências, lotes, cálculos, rubricas, tabelas legais, benefícios, rescisões, eSocial, CNAB e contabilização.',
      impact: 'Impacta pagamento dos colaboradores, holerites, encargos, obrigações legais e integrações banco/governo.',
    },
  },
  {
    prefix: 'personnel_',
    seed: {
      module: 'Serviço Pessoal',
      moduleKey: 'personnel',
      origin: 'Módulo Serviço Pessoal (DP)',
      purpose: 'Mantém prontuários, perfis LGPD, biometria facial, totens de ponto, contadores e configurações do DP.',
      impact: 'Impacta cadastro do colaborador, ponto facial, matrícula, crachá e a vida funcional no portal.',
    },
  },
  {
    prefix: 'employee_',
    seed: {
      module: 'Serviço Pessoal',
      moduleKey: 'personnel',
      origin: 'Módulo Serviço Pessoal (DP)',
      purpose: 'Guarda dependentes e dados vinculados ao colaborador.',
      impact: 'Impacta IRRF (dependentes), benefícios, pensões e o prontuário do colaborador.',
    },
  },
  {
    prefix: 'employment_',
    seed: {
      module: 'Serviço Pessoal',
      moduleKey: 'personnel',
      origin: 'Módulo Serviço Pessoal (DP)',
      purpose: 'Registra a linha do tempo funcional (admissão, mudanças de cargo, transferências, desligamento).',
      impact: 'Impacta histórico funcional, avos de rescisão e relatórios de DP.',
    },
  },
  {
    prefix: 'vacation_',
    seed: {
      module: 'Serviço Pessoal',
      moduleKey: 'personnel',
      origin: 'Férias e Afastamentos',
      purpose: 'Controla períodos aquisitivos, solicitações e aprovações de férias e afastamentos.',
      impact: 'Impacta saldo de férias, espelho de ponto, folha (férias/abono) e alertas de dobra.',
    },
  },
  {
    prefix: 'timesheet_',
    seed: {
      module: 'Controle de Ponto',
      moduleKey: 'time-clock',
      origin: 'Módulo Controle de Ponto',
      purpose: 'Guarda fechamentos de competência do ponto e suas versões imutáveis.',
      impact: 'Impacta travamento de batidas/ajustes, banco de horas consolidado e a base da folha.',
    },
  },
  {
    prefix: 'time_',
    seed: {
      module: 'Controle de Ponto',
      moduleKey: 'time-clock',
      origin: 'Módulo Controle de Ponto',
      purpose: 'Armazena batidas (com NSR e hash encadeado), ajustes aprovados e banco de horas.',
      impact: 'Impacta espelho de ponto, jornada, horas extras, AFD/AEJ e o cálculo da folha.',
    },
  },
  {
    prefix: 'work_',
    seed: {
      module: 'Controle de Ponto',
      moduleKey: 'time-clock',
      origin: 'Escalas de trabalho',
      purpose: 'Define modelos de escala (semanal/ciclo) e vigências de atribuição por colaborador.',
      impact: 'Impacta jornada prevista, tolerâncias, DSR, faltas e o espelho de ponto.',
    },
  },
  {
    prefix: 'supply_',
    seed: {
      module: 'Suprimentos',
      moduleKey: 'supplies',
      origin: 'Módulo Suprimentos',
      purpose: 'Sustenta itens, fornecedores, requisições, pedidos, cotações, recebimentos, estoque e kardex.',
      impact: 'Impacta compras, alçadas, almoxarifado, custo médio e rastreabilidade de materiais.',
    },
  },
  {
    prefix: 'Quotation',
    seed: {
      module: 'Suprimentos',
      moduleKey: 'supplies',
      origin: 'Módulo Suprimentos',
      purpose: 'Registra cotações de compra e seus itens.',
      impact: 'Impacta seleção de fornecedores e formação de preço dos pedidos.',
    },
  },
  {
    prefix: 'Supplier',
    seed: {
      module: 'Suprimentos',
      moduleKey: 'supplies',
      origin: 'Módulo Suprimentos',
      purpose: 'Guarda notas fiscais e documentos de fornecedores.',
      impact: 'Impacta recebimento, medição e conciliação de pedidos.',
    },
  },
  {
    prefix: 'compensation_',
    seed: {
      module: 'Cargos e salários',
      moduleKey: 'compensation',
      origin: 'Módulo Cargos e Salários',
      purpose: 'Guarda snapshots salariais, perfis de remuneração, posições, faixas e movimentações (tabelas novas).',
      impact: 'Impacta salário vigente lido pela folha, equidade salarial e aprovações de movimentação.',
    },
  },
  {
    prefix: 'document_',
    seed: {
      module: 'Documentos',
      moduleKey: 'documents',
      origin: 'Módulo Documentos (GED)',
      purpose: 'Sustenta o GED: versões, revisões, modelos, leituras, publicações e arquivos.',
      impact: 'Impacta gestão documental, aprovação, distribuição e evidências de leitura.',
    },
  },
  {
    prefix: 'Communication',
    seed: {
      module: 'Comunicação',
      moduleKey: 'communication',
      origin: 'Comunicação organizacional',
      purpose: 'Guarda comunicados, campanhas, mídias, confirmações de leitura e métricas.',
      impact: 'Impacta mural, comunicados obrigatórios, campanhas e indicadores de comunicação.',
    },
  },
  {
    prefix: 'organizational_',
    seed: {
      module: 'Comunicação',
      moduleKey: 'communication',
      origin: 'Comunicação organizacional',
      purpose: 'Tabelas da central de comunicação organizacional.',
      impact: 'Impacta publicação e acompanhamento de comunicados.',
    },
  },
  {
    prefix: 'Conversation',
    seed: {
      module: 'Comunicação',
      moduleKey: 'communication',
      origin: 'Chat corporativo',
      purpose: 'Armazena conversas e participantes do chat.',
      impact: 'Impacta o chat interno e o histórico de conversas.',
    },
  },
  {
    prefix: 'Monthly',
    seed: {
      module: 'Reunião Mensal',
      moduleKey: 'monthly-results',
      origin: 'Módulo Reunião Mensal de Resultados',
      purpose: 'Sustenta reuniões mensais, snapshots de indicadores, pautas, atas e acompanhamentos.',
      impact: 'Impacta o rito mensal de resultados, decisões e planos derivados.',
    },
  },
  {
    prefix: 'Task',
    seed: {
      module: 'Tarefas',
      moduleKey: 'tasks',
      origin: 'Central de Tarefas',
      purpose: 'Guarda tarefas do usuário e vínculos com os módulos de origem.',
      impact: 'Impacta a caixa de tarefas, prazos e pendências pessoais.',
    },
  },
  {
    prefix: 'Help',
    seed: {
      module: 'Central de Ajuda',
      moduleKey: 'help-center',
      origin: 'Central de Ajuda e assistente',
      purpose: 'Armazena artigos, guias e feedbacks da ajuda.',
      impact: 'Impacta a base de conhecimento e o assistente do portal.',
    },
  },
  {
    prefix: 'Support',
    seed: {
      module: 'Central de Atendimento',
      moduleKey: 'service-desk',
      origin: 'Central de Atendimento',
      purpose: 'Guarda chamados de suporte, mensagens e status.',
      impact: 'Impacta abertura e acompanhamento de chamados dos usuários.',
    },
  },
  {
    prefix: 'External',
    seed: {
      module: 'Integrações externas',
      moduleKey: 'integrations',
      origin: 'Integrações com sistemas externos',
      purpose: 'Guarda conectores, chaves de API pública e execuções de integração.',
      impact: 'Impacta SAP/Apdata/SE Suite, API pública e sincronizações.',
    },
  },
  {
    prefix: 'Inbound',
    seed: {
      module: 'Integrações externas',
      moduleKey: 'integrations',
      origin: 'Integrações com sistemas externos',
      purpose: 'Registra recebimentos de dados de sistemas externos.',
      impact: 'Impacta cargas de dados e reconciliação de integrações.',
    },
  },
  {
    prefix: 'Sla',
    seed: {
      module: 'Automações',
      moduleKey: 'automations',
      origin: 'Central de Automações',
      purpose: 'Define políticas de SLA e escalonamento de tarefas de workflow.',
      impact: 'Impacta prazos, alertas e escalonamentos automáticos.',
    },
  },
];

const EXACT_FALLBACKS: Record<string, CatalogSeed> = {
  company_holidays: {
    module: 'Controle de Ponto',
    moduleKey: 'time-clock',
    label: 'Feriados da empresa',
    origin: 'Calendário do ponto',
    purpose: 'Feriados usados na jornada prevista e no DSR.',
    impact: 'Impacta espelho de ponto, faltas, DSR sobre variáveis e cálculo da folha.',
  },
  _prisma_migrations: {
    module: 'Sistema',
    moduleKey: 'system',
    label: 'Histórico de migrations Prisma',
    origin: 'Prisma Migrate',
    purpose: 'Controla migrations aplicadas no banco.',
    impact: 'Impacta evolução do schema e segurança de deploys.',
  },
  NonConformity: {
    module: 'Não conformidades',
    moduleKey: 'nonconformities',
    origin: 'Módulo Não Conformidades',
    purpose: 'Registra não conformidades e tratativas.',
    impact: 'Impacta qualidade, planos de ação, auditorias e indicadores de desvio.',
  },
  ClosedMonth: {
    module: 'Indicadores',
    moduleKey: 'indicators',
    origin: 'Fechamento mensal',
    purpose: 'Controla meses fechados para indicadores e resultados.',
    impact: 'Impacta bloqueios de edição, apuração histórica e relatórios consolidados.',
  },
  Deviation: {
    module: 'Indicadores',
    moduleKey: 'indicators',
    origin: 'Análise de desvios',
    purpose: 'Registra desvios de indicadores e sua análise.',
    impact: 'Impacta planos de ação, causas, análises e acompanhamento de performance.',
  },
  ParameterCategory: {
    module: 'Configurações',
    moduleKey: 'settings',
    origin: 'Parâmetros administrativos',
    purpose: 'Agrupa parâmetros configuráveis.',
    impact: 'Impacta cadastros auxiliares, filtros e configurações usadas por módulos.',
  },
  ParameterItem: {
    module: 'Configurações',
    moduleKey: 'settings',
    origin: 'Parâmetros administrativos',
    purpose: 'Guarda valores de parâmetros configuráveis.',
    impact: 'Impacta listas, classificações, regras e comportamentos configuráveis.',
  },
};

export function getTableCatalogEntry(table: string): TableCatalogEntry {
  const seed = EXACT_CATALOG[table] ?? EXACT_FALLBACKS[table] ?? PREFIX_CATALOG.find((entry) => table.startsWith(entry.prefix))?.seed;
  if (seed) {
    return {
      ...seed,
      label: seed.label ?? humanizeTableName(table),
    };
  }

  return {
    module: 'Outras tabelas',
    moduleKey: 'other',
    label: humanizeTableName(table),
    origin: 'Schema public',
    purpose: 'Tabela física do banco ainda sem classificação específica no catálogo.',
    impact: 'Pode impactar telas, relatórios, integrações ou rotinas que dependam diretamente desses dados.',
  };
}

function humanizeTableName(table: string): string {
  if (table.startsWith('_')) return table;
  return table
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}
