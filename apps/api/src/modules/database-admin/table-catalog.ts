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
    module: 'Organizacao',
    moduleKey: 'organization',
    label: 'Empresas',
    origin: 'Cadastro base da plataforma',
    purpose: 'Guarda as empresas/tenants que usam o sistema.',
    impact: 'Afeta login, permissoes, dados por empresa, filiais e quase todos os modulos operacionais.',
  },
  Branch: {
    module: 'Organizacao',
    moduleKey: 'organization',
    label: 'Filiais',
    origin: 'Cadastro organizacional',
    purpose: 'Representa unidades, plantas ou filiais de uma empresa.',
    impact: 'Impacta segmentacao de usuarios, indicadores, documentos, auditorias e registros operacionais.',
  },
  OrgNode: {
    module: 'Organizacao',
    moduleKey: 'organization',
    label: 'Areas e setores',
    origin: 'Estrutura organizacional',
    purpose: 'Mantem a hierarquia de areas, setores e centros organizacionais.',
    impact: 'Afeta visibilidade, responsaveis, indicadores, documentos, planos de acao e relatorios.',
  },
  WorkPeriod: {
    module: 'Organizacao',
    moduleKey: 'organization',
    label: 'Periodos de trabalho',
    origin: 'Cadastro operacional',
    purpose: 'Define turnos ou periodos usados nas rotinas da empresa.',
    impact: 'Impacta apontamentos, operacao, seguranca patrimonial e analises por turno.',
  },
  User: {
    module: 'Acesso e permissoes',
    moduleKey: 'access',
    label: 'Usuarios',
    origin: 'Gestao de usuarios',
    purpose: 'Guarda contas, perfis de acesso e dados de autenticacao dos usuarios.',
    impact: 'Afeta login, auditoria, responsaveis, aprovacoes, visibilidade e todas as operacoes por usuario.',
  },
  Permission: {
    module: 'Acesso e permissoes',
    moduleKey: 'access',
    label: 'Permissoes',
    origin: 'Catalogo de seguranca',
    purpose: 'Lista permissoes disponiveis no sistema.',
    impact: 'Impacta liberacao de telas, acoes sensiveis e controles do portal administrativo.',
  },
  UserPermission: {
    module: 'Acesso e permissoes',
    moduleKey: 'access',
    label: 'Permissoes por usuario',
    origin: 'Gestao de usuarios',
    purpose: 'Relaciona usuarios diretamente a permissoes.',
    impact: 'Impacta o que cada usuario consegue visualizar, criar, editar ou excluir.',
  },
  AccessProfile: {
    module: 'Acesso e permissoes',
    moduleKey: 'access',
    label: 'Perfis de acesso',
    origin: 'Gestao de perfis',
    purpose: 'Define perfis reutilizaveis de acesso.',
    impact: 'Impacta atribuicao padronizada de permissoes e governanca de acesso.',
  },
  ProfilePermission: {
    module: 'Acesso e permissoes',
    moduleKey: 'access',
    label: 'Permissoes por perfil',
    origin: 'Gestao de perfis',
    purpose: 'Relaciona perfis de acesso com permissoes.',
    impact: 'Impacta todos os usuarios vinculados aos perfis alterados.',
  },
  RefreshToken: {
    module: 'Acesso e permissoes',
    moduleKey: 'access',
    label: 'Sessoes e tokens',
    origin: 'Autenticacao',
    purpose: 'Controla tokens usados para renovar sessoes.',
    impact: 'Impacta permanencia de login, revogacao de acesso e seguranca de sessoes.',
  },
  AppSetting: {
    module: 'Configuracoes',
    moduleKey: 'settings',
    label: 'Configuracoes do sistema',
    origin: 'Parametros globais',
    purpose: 'Armazena configuracoes persistidas da aplicacao.',
    impact: 'Impacta comportamento global, limites, toggles e ajustes administrativos.',
  },
  DbAdminAuditLog: {
    module: 'Administracao do banco',
    moduleKey: 'database-admin',
    label: 'Auditoria do banco',
    origin: 'Portal administrativo global',
    purpose: 'Registra acoes feitas nas ferramentas de administracao do banco.',
    impact: 'Impacta rastreabilidade, investigacao de incidentes e governanca tecnica.',
  },
  DbAdminBackup: {
    module: 'Administracao do banco',
    moduleKey: 'database-admin',
    label: 'Backups logicos',
    origin: 'Portal administrativo global',
    purpose: 'Guarda metadados de snapshots e backups feitos pelo admin do banco.',
    impact: 'Impacta restauracao preventiva e seguranca antes de operacoes destrutivas.',
  },
  AuditLog: {
    module: 'Auditoria tecnica',
    moduleKey: 'technical-audit',
    label: 'Logs de auditoria',
    origin: 'Auditoria da aplicacao',
    purpose: 'Registra eventos tecnicos e funcionais relevantes.',
    impact: 'Impacta rastreabilidade, conformidade, investigacao e suporte.',
  },
};

const PREFIX_CATALOG: Array<{ prefix: string; seed: CatalogSeed }> = [
  {
    prefix: 'Security',
    seed: {
      module: 'Seguranca patrimonial',
      moduleKey: 'security',
      origin: 'Modulo Seguranca Patrimonial',
      purpose: 'Sustenta cadastros, autorizacoes, movimentacoes, rondas, ocorrencias e auditoria da portaria.',
      impact: 'Impacta controle de acesso fisico, pessoas, veiculos, materiais, bloqueios, incidentes e registros da operacao.',
    },
  },
  {
    prefix: 'Prize',
    seed: {
      module: 'Gestao Premio',
      moduleKey: 'prize',
      origin: 'Modulo Gestao Premio',
      purpose: 'Armazena programas, competencias, anexos, regras, resultados e calculos de premiacao.',
      impact: 'Impacta apuracao de premios, espelhos, integracoes, folhas e auditoria de resultados.',
    },
  },
  {
    prefix: 'FoodSafety',
    seed: {
      module: 'Seguranca de alimentos',
      moduleKey: 'food-safety',
      origin: 'Modulo Seguranca de Alimentos',
      purpose: 'Mantem programas, processos, perigos, controles, fornecedores, lotes, rastreabilidade e recalls.',
      impact: 'Impacta HACCP, planos de controle, cadeia de suprimentos, conformidade e resposta a recalls.',
    },
  },
  {
    prefix: 'Document',
    seed: {
      module: 'Documentos',
      moduleKey: 'documents',
      origin: 'Modulo Documentos',
      purpose: 'Controla documentos, versoes, arquivos, workflows, permissoes, leituras e auditoria documental.',
      impact: 'Impacta gestao documental, aprovacao, distribuicao, revisao, retencao e evidencias de leitura.',
    },
  },
  {
    prefix: 'Audit',
    seed: {
      module: 'Auditorias',
      moduleKey: 'audits',
      origin: 'Modulo Auditorias',
      purpose: 'Gerencia programas, planos, checklists, evidencias, achados, relatorios e follow-up de auditoria.',
      impact: 'Impacta conformidade, avaliacao de riscos, planos de acao, evidencias e relatorios de auditoria.',
    },
  },
  {
    prefix: 'Form',
    seed: {
      module: 'Formularios',
      moduleKey: 'forms',
      origin: 'Modulo Formularios',
      purpose: 'Armazena modelos, campos, execucoes, respostas, evidencias, assinaturas e aprovacoes de formularios.',
      impact: 'Impacta registros operacionais, coletas, checklists, workflow, historico e indicadores baseados em formularios.',
    },
  },
  {
    prefix: 'Workflow',
    seed: {
      module: 'Workflows',
      moduleKey: 'workflows',
      origin: 'Motor de workflows',
      purpose: 'Define fluxos, versoes, nos, execucoes, tarefas, eventos, timers e integracoes.',
      impact: 'Impacta automacoes, aprovacoes, filas de trabalho, prazos e rastreabilidade de processos.',
    },
  },
  {
    prefix: 'Platform',
    seed: {
      module: 'Portal administrativo global',
      moduleKey: 'platform-admin',
      origin: 'Portal administrativo global',
      purpose: 'Controla usuarios globais, planos, modulos, empresas, contratos, releases, backups e saude da plataforma.',
      impact: 'Impacta administracao multiempresa, liberacao de modulos, suporte, faturamento e operacao da plataforma.',
    },
  },
  {
    prefix: 'Portal',
    seed: {
      module: 'Catalogo do portal',
      moduleKey: 'portal',
      origin: 'Catalogo de navegacao e features',
      purpose: 'Mantem modulos, paginas, funcionalidades, flags, regras de escopo e comunicados do portal.',
      impact: 'Impacta menus, rotas, disponibilidade de recursos, manutencoes e comunicacao interna.',
    },
  },
  {
    prefix: 'Compensation',
    seed: {
      module: 'Cargos e salarios',
      moduleKey: 'compensation',
      origin: 'Modulo Cargos e Salarios',
      purpose: 'Gerencia catalogo de cargos, descricoes, tabelas salariais, enquadramentos, movimentos e orcamentos.',
      impact: 'Impacta estrutura salarial, aprovacoes, simulacoes, budget e historico de alocacoes.',
    },
  },
  {
    prefix: 'Org',
    seed: {
      module: 'Organizacao',
      moduleKey: 'organization',
      origin: 'Estrutura organizacional',
      purpose: 'Mantem cargos, colaboradores, trilhas, aprovacoes e atribuicoes organizacionais.',
      impact: 'Impacta hierarquia, responsaveis, cargos e visibilidade de dados por area.',
    },
  },
  {
    prefix: 'Indicator',
    seed: {
      module: 'Indicadores',
      moduleKey: 'indicators',
      origin: 'Modulo Indicadores',
      purpose: 'Guarda indicadores, metas, resultados, anexos, comentarios e relacoes entre indicadores.',
      impact: 'Impacta dashboards, analises de performance, fechamento mensal e planos de acao.',
    },
  },
  {
    prefix: 'Strategic',
    seed: {
      module: 'Estrategia e OKRs',
      moduleKey: 'strategy',
      origin: 'Modulo Estrategia',
      purpose: 'Armazena mapas, perspectivas, objetivos, versoes e vinculos estrategicos.',
      impact: 'Impacta mapa estrategico, alinhamento de indicadores, OKRs e relatorios executivos.',
    },
  },
  {
    prefix: 'OKR',
    seed: {
      module: 'Estrategia e OKRs',
      moduleKey: 'strategy',
      origin: 'Modulo OKR',
      purpose: 'Controla ciclos, objetivos, resultados-chave e check-ins de OKR.',
      impact: 'Impacta acompanhamento de metas, progresso e alinhamento estrategico.',
    },
  },
  {
    prefix: 'Action',
    seed: {
      module: 'Planos de acao',
      moduleKey: 'actions',
      origin: 'Modulo Planos de Acao',
      purpose: 'Gerencia planos, tarefas, participantes, evidencias, comentarios, historico e analises estruturadas.',
      impact: 'Impacta tratativas, prazos, responsabilidades, MASP/PDCA/5W2H e acompanhamento de desvios.',
    },
  },
  {
    prefix: 'Project',
    seed: {
      module: 'Projetos',
      moduleKey: 'projects',
      origin: 'Modulo Projetos',
      purpose: 'Armazena projetos, marcos e tarefas.',
      impact: 'Impacta planejamento, execucao, prazos e acompanhamento de iniciativas.',
    },
  },
  {
    prefix: 'Risk',
    seed: {
      module: 'Riscos',
      moduleKey: 'risks',
      origin: 'Modulo Riscos',
      purpose: 'Mantem registros de riscos e seus atributos de avaliacao.',
      impact: 'Impacta priorizacao, controles, planos de mitigacao e visao de risco corporativo.',
    },
  },
  {
    prefix: 'Process',
    seed: {
      module: 'Processos',
      moduleKey: 'processes',
      origin: 'Modulo Processos',
      purpose: 'Modela processos, etapas e informacoes associadas.',
      impact: 'Impacta gestao por processos, formularios, riscos, auditorias e indicadores relacionados.',
    },
  },
  {
    prefix: 'Meeting',
    seed: {
      module: 'Reunioes',
      moduleKey: 'meetings',
      origin: 'Modulo Reunioes',
      purpose: 'Armazena reunioes, participantes, convidados, pautas e decisoes.',
      impact: 'Impacta governanca de decisoes, atas, pendencias e acompanhamento de compromissos.',
    },
  },
  {
    prefix: 'Message',
    seed: {
      module: 'Comunicacao',
      moduleKey: 'communication',
      origin: 'Mensageria interna',
      purpose: 'Armazena mensagens, anexos e reacoes.',
      impact: 'Impacta comunicacao interna, notificacoes e historico de conversas.',
    },
  },
];

const EXACT_FALLBACKS: Record<string, CatalogSeed> = {
  _prisma_migrations: {
    module: 'Sistema',
    moduleKey: 'system',
    label: 'Historico de migrations Prisma',
    origin: 'Prisma Migrate',
    purpose: 'Controla migrations aplicadas no banco.',
    impact: 'Impacta evolucao do schema e seguranca de deploys.',
  },
  NonConformity: {
    module: 'Nao conformidades',
    moduleKey: 'nonconformities',
    origin: 'Modulo Nao Conformidades',
    purpose: 'Registra nao conformidades e tratativas.',
    impact: 'Impacta qualidade, planos de acao, auditorias e indicadores de desvio.',
  },
  ClosedMonth: {
    module: 'Indicadores',
    moduleKey: 'indicators',
    origin: 'Fechamento mensal',
    purpose: 'Controla meses fechados para indicadores e resultados.',
    impact: 'Impacta bloqueios de edicao, apuracao historica e relatorios consolidados.',
  },
  Deviation: {
    module: 'Indicadores',
    moduleKey: 'indicators',
    origin: 'Analise de desvios',
    purpose: 'Registra desvios de indicadores e sua analise.',
    impact: 'Impacta planos de acao, causas, analises e acompanhamento de performance.',
  },
  ParameterCategory: {
    module: 'Configuracoes',
    moduleKey: 'settings',
    origin: 'Parametros administrativos',
    purpose: 'Agrupa parametros configuraveis.',
    impact: 'Impacta cadastros auxiliares, filtros e configuracoes usadas por modulos.',
  },
  ParameterItem: {
    module: 'Configuracoes',
    moduleKey: 'settings',
    origin: 'Parametros administrativos',
    purpose: 'Guarda valores de parametros configuraveis.',
    impact: 'Impacta listas, classificacoes, regras e comportamentos configuraveis.',
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
    purpose: 'Tabela fisica do banco ainda sem classificacao especifica no catalogo.',
    impact: 'Pode impactar telas, relatorios, integracoes ou rotinas que dependam diretamente desses dados.',
  };
}

function humanizeTableName(table: string): string {
  if (table.startsWith('_')) return table;
  return table
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}
