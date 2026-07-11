/**
 * Módulos de NEGÓCIO (alinhados às abas do menu) sobre o catálogo granular.
 *
 * O catálogo (portal-catalog.ts) continua granular (uma entrada por página/rota),
 * porque o PortalGateGuard resolve o acesso por código granular (inferModule).
 * Mas planos e a tela de administração passam a operar nas 10 abas do menu:
 * ligar/desligar uma aba liga/desliga TODOS os seus códigos granulares.
 *
 * Padrão (sempre ativo em qualquer plano): Meu Dia, Tarefas e Administração
 * (abrange usuários, aprovações, períodos, automações e relatórios) + sistema.
 */

export interface BusinessModule {
  code: string;
  name: string;
  menuOrder: number;
  /** true = sempre ativo (núcleo/sistema), não entra na composição de planos. */
  core?: boolean;
  /** Códigos granulares do catálogo que esta aba engloba. */
  members: string[];
}

export const BUSINESS_MODULES: BusinessModule[] = [
  // --- Padrão: sempre ativos em todos os planos ---
  { code: 'meu-dia', name: 'Meu Dia', menuOrder: 10, core: true, members: ['my-day'] },
  { code: 'tarefas', name: 'Tarefas', menuOrder: 20, core: true, members: ['tasks'] },
  {
    code: 'administracao',
    name: 'Administração',
    menuOrder: 40,
    core: true,
    members: ['aprovacoes-cargo', 'periods', 'automations', 'users', 'reports'],
  },

  // --- Negócio: distribuídos entre os planos ---
  {
    code: 'gestao-a-vista',
    name: 'Gestão à Vista',
    menuOrder: 30,
    members: [
      'visualization',
      'dashboard', // legado: /api/dashboard é a API do Painel Executivo
      'org',
      'strategy',
      'indicators',
      'deviations',
      'actions',
      'meetings',
      'monthly-results',
      'okrs',
      'insights',
      'treatments',
      'imports',
      'eficacia',
    ],
  },
  {
    code: 'qualidade-compliance',
    name: 'Qualidade e Compliance',
    menuOrder: 50,
    members: ['risks', 'nonconformities', 'audits', 'documents', 'processes', 'forms', 'projects', 'vision360'],
  },
  { code: 'seguranca-alimentos', name: 'Segurança dos Alimentos', menuOrder: 60, members: ['food-safety'] },
  { code: 'seguranca-patrimonial', name: 'Segurança Patrimonial', menuOrder: 70, members: ['asset-security'] },
  { code: 'cargos-salarios', name: 'Cargos e Salários', menuOrder: 80, members: ['compensation'] },
  { code: 'servico-pessoal', name: 'Serviço Pessoal', menuOrder: 85, members: ['personnel'] },
  { code: 'suprimentos', name: 'Suprimentos', menuOrder: 87, members: ['procurement', 'inventory'] },
  { code: 'comunicacao', name: 'Comunicação', menuOrder: 90, members: ['communication'] },
  { code: 'gestao-premio', name: 'Gestão de Prêmio', menuOrder: 100, members: ['prize'] },
];

/**
 * Módulos granulares de SISTEMA/Portal Global — sempre ativos (Super Admin e
 * infraestrutura). Não aparecem como aba de negócio nem entram em planos.
 */
export const SYSTEM_MODULE_CODES = [
  'auth',
  'access-control',
  'settings',
  'audit',
  'database-admin',
  'portal-admin',
  'integrations',
  'help-center',
  'directory',
];

/** Composição cumulativa dos planos por MÓDULO DE NEGÓCIO (sem os core/sistema). */
export const PLAN_BUSINESS_MODULES: Record<string, string[]> = {
  ESSENCIAL: ['gestao-a-vista'],
  PROFISSIONAL: ['gestao-a-vista', 'qualidade-compliance', 'comunicacao'],
  CORPORATIVO: [
    'gestao-a-vista',
    'qualidade-compliance',
    'comunicacao',
    'cargos-salarios',
    'seguranca-alimentos',
    'seguranca-patrimonial',
  ],
  ENTERPRISE: [
    'gestao-a-vista',
    'qualidade-compliance',
    'comunicacao',
    'cargos-salarios',
    'servico-pessoal',
    'suprimentos',
    'seguranca-alimentos',
    'seguranca-patrimonial',
    'gestao-premio',
  ],
  PERSONALIZADO: [],
};

const byCode = new Map(BUSINESS_MODULES.map((m) => [m.code, m]));

/** Membros granulares de uma aba de negócio (vazio se o código não existir). */
export function businessModuleMembers(code: string): string[] {
  return byCode.get(code)?.members ?? [];
}

/** Códigos granulares sempre ativos: módulos de negócio core + sistema. */
export function alwaysOnModuleCodes(): string[] {
  const core = BUSINESS_MODULES.filter((m) => m.core).flatMap((m) => m.members);
  return Array.from(new Set([...core, ...SYSTEM_MODULE_CODES]));
}

/**
 * Expande um plano para a lista de códigos GRANULARES incluídos:
 * sempre-ativos (core+sistema) + membros das abas de negócio do plano.
 */
export function expandPlanModules(planCode: string): string[] {
  const businessCodes = PLAN_BUSINESS_MODULES[planCode] ?? [];
  const granular = businessCodes.flatMap((code) => byCode.get(code)?.members ?? []);
  return Array.from(new Set([...alwaysOnModuleCodes(), ...granular]));
}
