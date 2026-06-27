export interface PermissionRecord {
  id: string;
  key: string;
  description: string;
  module: string;
  action: string;
}

export interface AccessRoleDefinition {
  value: string;
  label: string;
  shortLabel: string;
  description: string;
  recommendedFor: string;
}

export interface BusinessModuleDefinition {
  slug: string;
  title: string;
  description: string;
  prefixes: string[];
  standardAccess?: string;
}

export const ACCESS_ROLE_DEFINITIONS: AccessRoleDefinition[] = [
  {
    value: 'COMPANY_ADMIN',
    label: 'Administrador da empresa',
    shortLabel: 'Administrador',
    description: 'Configura a empresa, usuários, perfis, parâmetros e todos os módulos contratados.',
    recommendedFor: 'Responsável principal pelo ambiente da empresa.',
  },
  {
    value: 'DIRECTOR',
    label: 'Diretoria',
    shortLabel: 'Diretoria',
    description: 'Acompanha a organização de forma ampla e pode receber alçadas de aprovação.',
    recommendedFor: 'Diretores e liderança executiva.',
  },
  {
    value: 'MANAGER',
    label: 'Gestor',
    shortLabel: 'Gestor',
    description: 'Gerencia a operação e a equipe dentro das áreas autorizadas.',
    recommendedFor: 'Gerentes, coordenadores e líderes de processo.',
  },
  {
    value: 'ANALYST',
    label: 'Analista',
    shortLabel: 'Analista',
    description: 'Cria, edita e acompanha registros, sem receber administração total por padrão.',
    recommendedFor: 'Analistas e especialistas responsáveis por módulos.',
  },
  {
    value: 'COLLABORATOR',
    label: 'Colaborador',
    shortLabel: 'Colaborador',
    description: 'Executa tarefas e rotinas operacionais atribuídas a ele.',
    recommendedFor: 'Usuários que registram ou executam atividades.',
  },
  {
    value: 'VIEWER',
    label: 'Consulta',
    shortLabel: 'Consulta',
    description: 'Acessa informações liberadas somente para leitura.',
    recommendedFor: 'Conselheiros, auditores convidados e usuários de consulta.',
  },
];

export const BUSINESS_MODULE_DEFINITIONS: BusinessModuleDefinition[] = [
  {
    slug: 'meu-dia',
    title: 'Meu Dia',
    description: 'Prioridades, ações rápidas, preferências pessoais e visão da equipe.',
    prefixes: ['myday'],
    standardAccess: 'Todo usuário ativo acessa as próprias prioridades. As permissões abaixo ampliam ações, equipe e administração.',
  },
  {
    slug: 'tarefas',
    title: 'Tarefas',
    description: 'Caixa pessoal de tarefas e documentos liberados para edição.',
    prefixes: [],
    standardAccess: 'Acesso padrão do usuário. O que ele pode fazer em cada tarefa depende da permissão do módulo de origem.',
  },
  {
    slug: 'central-atendimento',
    title: 'Central de Atendimento',
    description: 'Abertura e acompanhamento de chamados de suporte.',
    prefixes: [],
    standardAccess: 'Todo usuário ativo pode abrir e acompanhar os próprios chamados. A visão da empresa segue o papel administrativo.',
  },
  {
    slug: 'gestao-a-vista',
    title: 'Gestão à Vista',
    description: 'Painéis, estrutura, estratégia, indicadores, desvios, ações, reuniões e OKRs.',
    prefixes: [
      'dashboard',
      'visualization',
      'insights',
      'launches',
      'results',
      'indicators',
      'actions',
      'deviations',
      'treatments',
      'eficacia',
      'meetings',
      'monthly',
      'strategy',
      'okrs',
      'org',
    ],
  },
  {
    slug: 'administracao',
    title: 'Administração',
    description: 'Usuários, perfis, parâmetros, auditoria, importações, relatórios, automações e integrações.',
    prefixes: ['settings', 'users', 'audit', 'imports', 'reports', 'automations', 'integrations', 'help', 'ai'],
  },
  {
    slug: 'qualidade-compliance',
    title: 'Qualidade e Compliance',
    description: 'Riscos, NCs, documentos, auditorias, processos, formulários, cronogramas e impactos.',
    prefixes: ['projects', 'risks', 'nc', 'doc', 'audits', 'processes', 'forms', 'vision360'],
  },
  {
    slug: 'seguranca-alimentos',
    title: 'Segurança dos Alimentos',
    description: 'FSMS, APPCC, processos, monitoramentos, cadeia, recall e fluxo 3D.',
    prefixes: ['fsms'],
  },
  {
    slug: 'seguranca-patrimonial',
    title: 'Segurança Patrimonial',
    description: 'Portarias, acessos, autorizações, rondas, ocorrências, materiais e chaves.',
    prefixes: ['asset-security'],
  },
  {
    slug: 'cargos-salarios',
    title: 'Cargos e Salários',
    description: 'Estrutura, quadro, cargos, faixas, salários, orçamento, mérito e movimentações.',
    prefixes: ['compensation'],
  },
  {
    slug: 'comunicacao',
    title: 'Comunicação',
    description: 'Mural, comunicados, campanhas, mídias, métricas, diretório e chat.',
    prefixes: ['communication', 'directory'],
  },
  {
    slug: 'gestao-premio',
    title: 'Gestão de Prêmio',
    description: 'Programas, competências, regras, apuração, ajustes, espelhos e folha.',
    prefixes: ['prize'],
  },
];

export const DEPRECATED_PERMISSION_KEYS = new Set([
  // A função/relatório de emergência foi retirada temporariamente da Segurança Patrimonial.
  'asset-security:emergency',
]);

const ACTION_LABELS: Record<string, string> = {
  view: 'Consultar',
  create: 'Criar / registrar',
  update: 'Editar / executar',
  delete: 'Excluir / inativar',
  approve: 'Aprovar / decidir',
  manage: 'Administrar',
  export: 'Exportar',
  publish: 'Publicar',
  assist: 'Usar IA',
  complete: 'Concluir',
  link: 'Vincular',
};

const FEATURE_LABELS: Record<string, string> = {
  Dashboard: 'Painéis executivos',
  Lançamentos: 'Resultados e lançamentos',
  Indicadores: 'Indicadores',
  'Planos de ação': 'Planos de ação',
  Desvios: 'Desvios',
  Tratativas: 'Tratativas',
  Eficácia: 'Eficácia',
  Projetos: 'Cronogramas e projetos',
  Riscos: 'Riscos',
  'Nao Conformidades': 'Não conformidades',
  Documentos: 'Documentos',
  Auditorias: 'Auditorias',
  Processos: 'Processos e SIPOC',
  'Seguranca dos Alimentos': 'Segurança dos Alimentos',
  'Seguranca Patrimonial': 'Segurança Patrimonial',
  Formularios: 'Formulários e checklists',
  Reuniões: 'Reuniões',
  'Reunião Mensal': 'Reunião Mensal',
  Estratégia: 'Estratégia',
  OKRs: 'OKRs',
  Estrutura: 'Estrutura organizacional',
  'Cargos e Salarios': 'Cargos e Salários',
  Importações: 'Importações',
  Relatórios: 'Relatórios',
  Configurações: 'Configurações',
  Usuários: 'Usuários e perfis',
  Auditoria: 'Auditoria do sistema',
  IA: 'Inteligência artificial',
  Comunicação: 'Comunicação organizacional',
  Comunicacao: 'Chat e mensagens',
  Integracoes: 'Integrações',
  Ajuda: 'Central de Ajuda',
  'Visão 360°': 'Impactos e Visão 360°',
  Automações: 'Central de Automações',
  'Meu Dia': 'Meu Dia',
  'Gestão de Prêmio': 'Gestão de Prêmio',
};

export const ACCESS_LEVELS = [
  { value: 'none', label: 'Sem acesso', actions: [] },
  { value: 'view', label: 'Consulta', actions: ['view'] },
  { value: 'operate', label: 'Operação', actions: ['view', 'create', 'update', 'complete', 'link', 'assist'] },
  { value: 'manage', label: 'Gestão completa', actions: null },
] as const;

export function getRoleDefinition(role: string | null | undefined) {
  return ACCESS_ROLE_DEFINITIONS.find((item) => item.value === role);
}

export function isDeprecatedPermissionKey(key: string) {
  return DEPRECATED_PERMISSION_KEYS.has(key);
}

export function getBusinessModule(permission: PermissionRecord) {
  if (permission.key.startsWith('org:positions:')) {
    return BUSINESS_MODULE_DEFINITIONS.find((module) => module.slug === 'cargos-salarios')!;
  }
  const prefix = permission.key.split(':')[0];
  return (
    BUSINESS_MODULE_DEFINITIONS.find((module) => module.prefixes.includes(prefix)) ??
    BUSINESS_MODULE_DEFINITIONS.find((module) => module.slug === 'administracao')!
  );
}

export function getFeatureLabel(module: string) {
  return FEATURE_LABELS[module] ?? module;
}

export function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function isSensitivePermission(permission: PermissionRecord) {
  return (
    ['delete', 'approve', 'publish', 'manage', 'export'].includes(permission.action) ||
    permission.key.includes('salary:individual') ||
    permission.key === 'prize:salary:view' ||
    permission.key === 'users:permissions' ||
    permission.key === 'users:manage'
  );
}

export function isPermissionCompatibleWithRole(permission: PermissionRecord, role?: string | null) {
  if (!role) return true;
  if (permission.key.startsWith('users:') || permission.key.startsWith('settings:')) {
    return role === 'COMPANY_ADMIN';
  }
  return true;
}

export function permissionModuleCount(permissions: PermissionRecord[], keys: string[]) {
  const selected = new Set(keys);
  return new Set(
    permissions
      .filter((permission) => selected.has(permission.key) && !isDeprecatedPermissionKey(permission.key))
      .map((permission) => getBusinessModule(permission).slug),
  ).size;
}
