/**
 * Catalogo-semente do registro do portal. Fonte para popular Portal{Module,Page,Feature}.
 * O sync e aditivo por code e atualiza apenas metadados controlados pelo produto.
 */

export interface CatalogModule {
  code: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  route?: string;
  menuOrder: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  systemRequired?: boolean;
  nonBlockable?: boolean;
  dependencies?: string[];
}

export interface CatalogPage {
  code: string;
  moduleCode: string;
  name: string;
  title: string;
  route: string;
  menuOrder?: number;
}

export interface CatalogFeature {
  code: string;
  moduleCode: string;
  name: string;
  criticality?: 'low' | 'medium' | 'high' | 'critical';
}

export const CATALOG_MODULES: CatalogModule[] = [
  { code: 'my-day', name: 'Meu Dia', category: 'Meu Dia', route: '/meu-dia', menuOrder: 10, criticality: 'medium' },
  { code: 'tasks', name: 'Tarefas', category: 'Tarefas', route: '/tarefas', menuOrder: 20, criticality: 'medium' },

  { code: 'visualization', name: 'Painel Executivo', category: 'Estrategia', route: '/visualization', menuOrder: 30, criticality: 'low' },
  { code: 'org', name: 'Arvore Organizacional', category: 'Estrategia', route: '/org', menuOrder: 31, criticality: 'medium' },
  { code: 'strategy', name: 'Mapa Estrategico', category: 'Estrategia', route: '/strategy', menuOrder: 32, criticality: 'medium' },
  { code: 'indicators', name: 'Indicadores', category: 'Estrategia', route: '/indicators', menuOrder: 33, criticality: 'high' },
  { code: 'deviations', name: 'Desvios', category: 'Estrategia', route: '/deviations', menuOrder: 34, criticality: 'medium' },
  { code: 'actions', name: 'Plano de Acao', category: 'Estrategia', route: '/actions', menuOrder: 35, criticality: 'high' },
  { code: 'meetings', name: 'Reunioes', category: 'Estrategia', route: '/meetings', menuOrder: 36, criticality: 'low' },
  { code: 'monthly-results', name: 'Reuniao Mensal', category: 'Estrategia', route: '/monthly-results', menuOrder: 37, criticality: 'medium' },
  { code: 'okrs', name: 'OKRs', category: 'Estrategia', route: '/okrs', menuOrder: 38, criticality: 'low' },

  { code: 'aprovacoes-cargo', name: 'Aprovacoes', category: 'Administracao', route: '/aprovacoes-cargo', menuOrder: 40, criticality: 'medium' },
  { code: 'periods', name: 'Periodos', category: 'Administracao', route: '/periods', menuOrder: 41, criticality: 'high' },
  { code: 'automations', name: 'Central de Automacoes', category: 'Administracao', route: '/central-automacoes', menuOrder: 42, criticality: 'medium' },
  { code: 'users', name: 'Usuarios', category: 'Administracao', route: '/users', menuOrder: 43, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'reports', name: 'Relatorios e Exportacoes', category: 'Administracao', route: '/reports', menuOrder: 44, criticality: 'medium' },

  { code: 'risks', name: 'Riscos', category: 'Qualidade e Compliance', route: '/risks', menuOrder: 50, criticality: 'high' },
  { code: 'nonconformities', name: 'Nao Conformidades', category: 'Qualidade e Compliance', route: '/nonconformities', menuOrder: 51, criticality: 'high' },
  { code: 'audits', name: 'Auditorias', category: 'Qualidade e Compliance', route: '/audits', menuOrder: 52, criticality: 'high' },
  { code: 'documents', name: 'Documentos', category: 'Qualidade e Compliance', route: '/documents', menuOrder: 53, criticality: 'medium' },
  { code: 'processes', name: 'SIPOC', category: 'Qualidade e Compliance', route: '/processes', menuOrder: 54, criticality: 'medium' },
  { code: 'forms', name: 'Formularios', category: 'Qualidade e Compliance', route: '/forms', menuOrder: 55, criticality: 'medium' },
  { code: 'projects', name: 'Cronogramas', category: 'Qualidade e Compliance', route: '/projects', menuOrder: 56, criticality: 'low' },
  { code: 'vision360', name: 'Impactos', category: 'Qualidade e Compliance', route: '/central-impactos', menuOrder: 57, criticality: 'medium' },

  { code: 'food-safety', name: 'Seguranca dos Alimentos', description: 'FSMS, APPCC, processos, perigos, cadeia e inteligencia', category: 'Seguranca dos Alimentos', route: '/seguranca-alimentos', menuOrder: 60, criticality: 'medium' },
  { code: 'asset-security', name: 'Seguranca Patrimonial', category: 'Seguranca Patrimonial', route: '/seguranca-patrimonial', menuOrder: 70, criticality: 'high' },
  { code: 'compensation', name: 'Cargos e Salarios', description: 'Plano de cargos, quadro, tabelas salariais e movimentacoes', category: 'Cargos e Salarios', route: '/cargos-salarios', menuOrder: 80, criticality: 'high' },
  { code: 'communication', name: 'Comunicacao', category: 'Comunicacao', route: '/comunicacao', menuOrder: 90, criticality: 'medium' },
  { code: 'prize', name: 'Gestao de Premio', description: 'Remuneracao variavel: anexos, competencias, apuracao, folha e espelho', category: 'Gestao de Premio', route: '/gestao-premio', menuOrder: 100, criticality: 'high' },

  { code: 'settings', name: 'Configuracoes', category: 'Portal Global', route: '/settings', menuOrder: 200, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'database-admin', name: 'Administracao do Banco', category: 'Portal Global', route: '/settings/database', menuOrder: 201, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'portal-admin', name: 'Central de Administracao do Portal', category: 'Portal Global', route: '/settings/portal', menuOrder: 202, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'integrations', name: 'Integracoes Globais', category: 'Portal Global', route: '/integracoes', menuOrder: 203, criticality: 'medium' },
  { code: 'audit', name: 'Auditoria', category: 'Portal Global', route: '/audit', menuOrder: 204, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'auth', name: 'Autenticacao', category: 'Sistema', menuOrder: 300, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'access-control', name: 'Controle de Acesso', category: 'Sistema', menuOrder: 301, criticality: 'critical', systemRequired: true, nonBlockable: true },

  { code: 'dashboard', name: 'Dashboard legado', category: 'Legado', route: '/dashboard', menuOrder: 900, criticality: 'low' },
  { code: 'imports', name: 'Importacoes', category: 'Legado', route: '/imports', menuOrder: 901, criticality: 'low' },
  { code: 'treatments', name: 'Tratativas', category: 'Legado', route: '/treatments', menuOrder: 902, criticality: 'medium' },
  { code: 'eficacia', name: 'Analise de Eficacia', category: 'Legado', route: '/eficacia', menuOrder: 903, criticality: 'medium' },
  { code: 'insights', name: 'Insights', category: 'Legado', route: '/insights', menuOrder: 904, criticality: 'low' },
  { code: 'directory', name: 'Pessoas', category: 'Legado', route: '/pessoas', menuOrder: 905, criticality: 'low' },
  { code: 'help-center', name: 'Central de Ajuda', category: 'Legado', route: '/ajuda', menuOrder: 906, criticality: 'low' },
];

export const CATALOG_PAGES: CatalogPage[] = [
  { code: 'my-day.main', moduleCode: 'my-day', name: 'Meu Dia', title: 'Meu Dia', route: '/meu-dia', menuOrder: 10 },
  { code: 'tasks.main', moduleCode: 'tasks', name: 'Tarefas', title: 'Tarefas', route: '/tarefas', menuOrder: 20 },

  { code: 'visualization.main', moduleCode: 'visualization', name: 'Painel Executivo', title: 'Painel Executivo', route: '/visualization', menuOrder: 30 },
  { code: 'org.main', moduleCode: 'org', name: 'Arvore Organizacional', title: 'Arvore Organizacional', route: '/org', menuOrder: 31 },
  { code: 'strategy.main', moduleCode: 'strategy', name: 'Mapa Estrategico', title: 'Mapa Estrategico', route: '/strategy', menuOrder: 32 },
  { code: 'indicators.list', moduleCode: 'indicators', name: 'Indicadores', title: 'Indicadores', route: '/indicators', menuOrder: 33 },
  { code: 'indicators.detail', moduleCode: 'indicators', name: 'Detalhe do indicador', title: 'Indicador', route: '/indicators/[id]', menuOrder: 33 },
  { code: 'deviations.list', moduleCode: 'deviations', name: 'Desvios', title: 'Desvios', route: '/deviations', menuOrder: 34 },
  { code: 'actions.list', moduleCode: 'actions', name: 'Plano de Acao', title: 'Plano de Acao', route: '/actions', menuOrder: 35 },
  { code: 'meetings.list', moduleCode: 'meetings', name: 'Reunioes', title: 'Reunioes', route: '/meetings', menuOrder: 36 },
  { code: 'monthly-results.main', moduleCode: 'monthly-results', name: 'Reuniao Mensal', title: 'Reuniao Mensal', route: '/monthly-results', menuOrder: 37 },
  { code: 'okrs.main', moduleCode: 'okrs', name: 'OKRs', title: 'OKRs', route: '/okrs', menuOrder: 38 },

  { code: 'approvals.main', moduleCode: 'aprovacoes-cargo', name: 'Aprovacoes', title: 'Aprovacoes', route: '/aprovacoes-cargo', menuOrder: 40 },
  { code: 'periods.main', moduleCode: 'periods', name: 'Periodos', title: 'Periodos', route: '/periods', menuOrder: 41 },
  { code: 'automations.flows', moduleCode: 'automations', name: 'Central de Automacoes', title: 'Automacoes', route: '/central-automacoes', menuOrder: 42 },
  { code: 'automations.builder', moduleCode: 'automations', name: 'Construtor de Fluxo', title: 'Construtor de Fluxo', route: '/central-automacoes/fluxos/construtor', menuOrder: 42 },
  { code: 'users.main', moduleCode: 'users', name: 'Usuarios', title: 'Usuarios', route: '/users', menuOrder: 43 },
  { code: 'reports.list', moduleCode: 'reports', name: 'Relatorios e Exportacoes', title: 'Relatorios e Exportacoes', route: '/reports', menuOrder: 44 },

  { code: 'risks.list', moduleCode: 'risks', name: 'Riscos', title: 'Registro de Riscos', route: '/risks', menuOrder: 50 },
  { code: 'nonconformities.list', moduleCode: 'nonconformities', name: 'Nao Conformidades', title: 'Nao Conformidades', route: '/nonconformities', menuOrder: 51 },
  { code: 'audits.list', moduleCode: 'audits', name: 'Auditorias', title: 'Auditorias e Compliance', route: '/audits', menuOrder: 52 },
  { code: 'documents.list', moduleCode: 'documents', name: 'Documentos', title: 'Gestao Documental', route: '/documents', menuOrder: 53 },
  { code: 'processes.sipoc', moduleCode: 'processes', name: 'SIPOC', title: 'SIPOC', route: '/processes', menuOrder: 54 },
  { code: 'forms.list', moduleCode: 'forms', name: 'Formularios', title: 'Formularios e Checklists', route: '/forms', menuOrder: 55 },
  { code: 'projects.list', moduleCode: 'projects', name: 'Cronogramas', title: 'Cronogramas', route: '/projects', menuOrder: 56 },
  { code: 'vision360.impacts', moduleCode: 'vision360', name: 'Impactos', title: 'Central de Impactos', route: '/central-impactos', menuOrder: 57 },
  { code: 'processes.workflow', moduleCode: 'processes', name: 'Processo', title: 'Processo', route: '/processes?view=processo', menuOrder: 58 },

  { code: 'food-safety.flow', moduleCode: 'food-safety', name: 'Fluxograma', title: 'Fluxograma', route: '/seguranca-alimentos?tab=flow', menuOrder: 60 },
  { code: 'food-safety.overview', moduleCode: 'food-safety', name: 'Visao Geral', title: 'Seguranca dos Alimentos', route: '/seguranca-alimentos?tab=overview', menuOrder: 61 },
  { code: 'food-safety.processes', moduleCode: 'food-safety', name: 'Processos', title: 'Processos', route: '/seguranca-alimentos?tab=processes', menuOrder: 62 },
  { code: 'food-safety.hazards', moduleCode: 'food-safety', name: 'Perigos / APPCC', title: 'Perigos / APPCC', route: '/seguranca-alimentos?tab=hazards', menuOrder: 63 },
  { code: 'food-safety.monitoring', moduleCode: 'food-safety', name: 'Monitoramento', title: 'Monitoramento', route: '/seguranca-alimentos?tab=monitoring', menuOrder: 64 },
  { code: 'food-safety.compliance', moduleCode: 'food-safety', name: 'Compliance', title: 'Compliance', route: '/seguranca-alimentos?tab=compliance', menuOrder: 65 },
  { code: 'food-safety.chain', moduleCode: 'food-safety', name: 'Cadeia e Recall', title: 'Cadeia e Recall', route: '/seguranca-alimentos?tab=chain', menuOrder: 66 },
  { code: 'food-safety.intelligence', moduleCode: 'food-safety', name: 'Inteligencia', title: 'Inteligencia', route: '/seguranca-alimentos?tab=intelligence', menuOrder: 67 },
  { code: 'food-safety.matrix', moduleCode: 'food-safety', name: 'Matriz Geral', title: 'Matriz Geral', route: '/seguranca-alimentos?tab=matrix', menuOrder: 68 },

  { code: 'asset-security.operation', moduleCode: 'asset-security', name: 'Operacao', title: 'Operacao', route: '/seguranca-patrimonial?tab=operation', menuOrder: 70 },
  { code: 'asset-security.people', moduleCode: 'asset-security', name: 'Pessoas e Veiculos', title: 'Pessoas e Veiculos', route: '/seguranca-patrimonial?tab=people', menuOrder: 71 },
  { code: 'asset-security.authorizations', moduleCode: 'asset-security', name: 'Autorizacoes', title: 'Autorizacoes', route: '/seguranca-patrimonial?tab=authorizations', menuOrder: 72 },
  { code: 'asset-security.rounds', moduleCode: 'asset-security', name: 'Rondas e Ocorrencias', title: 'Rondas e Ocorrencias', route: '/seguranca-patrimonial?tab=rounds', menuOrder: 73 },
  { code: 'asset-security.assets', moduleCode: 'asset-security', name: 'Materiais e Chaves', title: 'Materiais e Chaves', route: '/seguranca-patrimonial?tab=assets', menuOrder: 74 },
  { code: 'asset-security.settings', moduleCode: 'asset-security', name: 'Configuracoes', title: 'Configuracoes', route: '/seguranca-patrimonial?tab=settings', menuOrder: 75 },

  { code: 'compensation.overview', moduleCode: 'compensation', name: 'Visao Geral', title: 'Cargos e Salarios', route: '/cargos-salarios', menuOrder: 80 },
  { code: 'compensation.structure', moduleCode: 'compensation', name: 'Estrutura e Quadro', title: 'Estrutura e Quadro', route: '/cargos-salarios/estrutura-quadro', menuOrder: 81 },
  { code: 'compensation.jobs', moduleCode: 'compensation', name: 'Catalogo de Cargos', title: 'Catalogo de Cargos', route: '/cargos-salarios/catalogo', menuOrder: 82 },
  { code: 'compensation.descriptions', moduleCode: 'compensation', name: 'Descricoes', title: 'Descricoes', route: '/cargos-salarios/descricoes', menuOrder: 83 },
  { code: 'compensation.salary-tables', moduleCode: 'compensation', name: 'Tabelas Salariais', title: 'Tabelas Salariais', route: '/cargos-salarios/tabelas-salariais', menuOrder: 84 },
  { code: 'compensation.salary-fit', moduleCode: 'compensation', name: 'Enquadramento', title: 'Enquadramento', route: '/cargos-salarios/enquadramento', menuOrder: 85 },
  { code: 'compensation.movements', moduleCode: 'compensation', name: 'Movimentacoes', title: 'Movimentacoes', route: '/cargos-salarios/movimentacoes', menuOrder: 86 },
  { code: 'compensation.cycles', moduleCode: 'compensation', name: 'Ciclos de Merito', title: 'Ciclos de Merito', route: '/cargos-salarios/ciclos', menuOrder: 87 },
  { code: 'compensation.budget', moduleCode: 'compensation', name: 'Orcamento de Pessoal', title: 'Orcamento de Pessoal', route: '/cargos-salarios/orcamento', menuOrder: 88 },
  { code: 'compensation.surveys', moduleCode: 'compensation', name: 'Pesquisas Salariais', title: 'Pesquisas Salariais', route: '/cargos-salarios/pesquisas', menuOrder: 89 },
  { code: 'compensation.simulations', moduleCode: 'compensation', name: 'Simulacoes', title: 'Simulacoes', route: '/cargos-salarios/simulacoes', menuOrder: 90 },
  { code: 'compensation.approvals', moduleCode: 'compensation', name: 'Aprovacoes', title: 'Aprovacoes', route: '/cargos-salarios/aprovacoes', menuOrder: 91 },
  { code: 'compensation.settings', moduleCode: 'compensation', name: 'Configuracoes', title: 'Configuracoes', route: '/cargos-salarios/configuracoes', menuOrder: 92 },
  { code: 'compensation.reports', moduleCode: 'compensation', name: 'Relatorios', title: 'Relatorios', route: '/cargos-salarios/relatorios', menuOrder: 93 },

  { code: 'communication.wall', moduleCode: 'communication', name: 'Meu Mural', title: 'Meu Mural', route: '/comunicacao?tab=mural', menuOrder: 100 },
  { code: 'communication.central', moduleCode: 'communication', name: 'Central', title: 'Central', route: '/comunicacao?tab=central', menuOrder: 101 },
  { code: 'communication.create', moduleCode: 'communication', name: 'Criar', title: 'Criar Comunicado', route: '/comunicacao?tab=criar', menuOrder: 102 },
  { code: 'communication.campaigns', moduleCode: 'communication', name: 'Campanhas', title: 'Campanhas', route: '/comunicacao?tab=campanhas', menuOrder: 103 },
  { code: 'communication.media', moduleCode: 'communication', name: 'Midias', title: 'Midias', route: '/comunicacao?tab=midias', menuOrder: 104 },
  { code: 'communication.metrics', moduleCode: 'communication', name: 'Metricas', title: 'Metricas', route: '/comunicacao?tab=metricas', menuOrder: 105 },
  { code: 'communication.chat', moduleCode: 'communication', name: 'Chat', title: 'Chat', route: '/comunicacao?tab=chat', menuOrder: 106 },

  { code: 'prize.overview', moduleCode: 'prize', name: 'Visao Geral do Premio', title: 'Gestao de Premio', route: '/gestao-premio', menuOrder: 110 },
  { code: 'prize.programs', moduleCode: 'prize', name: 'Programas de Premio', title: 'Programas de Premio', route: '/gestao-premio/programas', menuOrder: 111 },
  { code: 'prize.competences', moduleCode: 'prize', name: 'Competencias', title: 'Competencias', route: '/gestao-premio/competencias', menuOrder: 112 },
  { code: 'prize.annexes', moduleCode: 'prize', name: 'Anexos e Regras', title: 'Anexos e Regras', route: '/gestao-premio/anexos', menuOrder: 113 },
  { code: 'prize.actuals', moduleCode: 'prize', name: 'Realizado', title: 'Realizado', route: '/gestao-premio/realizado', menuOrder: 114 },
  { code: 'prize.eligible', moduleCode: 'prize', name: 'Colaboradores Elegiveis', title: 'Colaboradores Elegiveis', route: '/gestao-premio/colaboradores', menuOrder: 115 },
  { code: 'prize.calc', moduleCode: 'prize', name: 'Apuracao Mensal', title: 'Apuracao Mensal', route: '/gestao-premio/apuracao', menuOrder: 116 },
  { code: 'prize.adjustments', moduleCode: 'prize', name: 'Ajustes e Excecoes', title: 'Ajustes e Excecoes', route: '/gestao-premio/ajustes', menuOrder: 117 },
  { code: 'prize.payslips', moduleCode: 'prize', name: 'Espelhos do Premio', title: 'Espelhos do Premio', route: '/gestao-premio/espelhos', menuOrder: 118 },
  { code: 'prize.reports', moduleCode: 'prize', name: 'Relatorio e Auditoria', title: 'Relatorio e Auditoria', route: '/gestao-premio/relatorios', menuOrder: 119 },
  { code: 'prize.payroll', moduleCode: 'prize', name: 'Integracao com a Folha', title: 'Integracao com a Folha', route: '/gestao-premio/folha', menuOrder: 120 },
  { code: 'prize.connectors', moduleCode: 'prize', name: 'Integracoes do Premio', title: 'Integracoes do Premio', route: '/platform-admin?section=externalIntegrations&tab=prize', menuOrder: 199 },

  { code: 'settings.main', moduleCode: 'settings', name: 'Configuracoes', title: 'Configuracoes', route: '/settings', menuOrder: 200 },
  { code: 'database-admin.main', moduleCode: 'database-admin', name: 'Administracao do Banco', title: 'Banco de Dados', route: '/settings/database', menuOrder: 201 },
  { code: 'portal-admin.main', moduleCode: 'portal-admin', name: 'Central do Portal', title: 'Central de Administracao do Portal', route: '/settings/portal', menuOrder: 202 },
  { code: 'integrations.main', moduleCode: 'integrations', name: 'Integracoes', title: 'Integracoes', route: '/integracoes', menuOrder: 203 },
  { code: 'audit.main', moduleCode: 'audit', name: 'Auditoria', title: 'Auditoria', route: '/audit', menuOrder: 204 },
  { code: 'directory.list', moduleCode: 'directory', name: 'Pessoas', title: 'Pessoas', route: '/pessoas', menuOrder: 905 },
  { code: 'help-center.main', moduleCode: 'help-center', name: 'Central de Ajuda', title: 'Central de Ajuda', route: '/ajuda', menuOrder: 906 },
  { code: 'dashboard.legacy', moduleCode: 'dashboard', name: 'Dashboard legado', title: 'Dashboard legado', route: '/dashboard', menuOrder: 900 },
];

export const CATALOG_FEATURES: CatalogFeature[] = [
  { code: 'communication.attachments', moduleCode: 'communication', name: 'Enviar anexos em mensagens' },
  { code: 'communication.mute', moduleCode: 'communication', name: 'Silenciar conversas' },
  { code: 'communication.pin', moduleCode: 'communication', name: 'Fixar conversas' },
  { code: 'communication.create', moduleCode: 'communication', name: 'Criar comunicados' },
  { code: 'communication.metrics', moduleCode: 'communication', name: 'Visualizar metricas de comunicacao' },
  { code: 'integrations.preference', moduleCode: 'integrations', name: 'Configurar preferencias de integracao' },
  { code: 'help-center.feedback', moduleCode: 'help-center', name: 'Registrar feedback de artigo' },
  { code: 'help-center.manage', moduleCode: 'help-center', name: 'Administrar artigos da ajuda', criticality: 'medium' },

  { code: 'indicators.create', moduleCode: 'indicators', name: 'Criar indicador' },
  { code: 'indicators.update', moduleCode: 'indicators', name: 'Editar indicador' },
  { code: 'indicators.delete', moduleCode: 'indicators', name: 'Excluir indicador', criticality: 'high' },
  { code: 'indicators.launch', moduleCode: 'indicators', name: 'Lancar resultado' },
  { code: 'indicators.import', moduleCode: 'indicators', name: 'Importar resultados' },
  { code: 'indicators.export', moduleCode: 'indicators', name: 'Exportar relatorio' },
  { code: 'indicators.history', moduleCode: 'indicators', name: 'Visualizar historico' },
  { code: 'actions.create', moduleCode: 'actions', name: 'Criar acao' },
  { code: 'actions.update', moduleCode: 'actions', name: 'Editar acao' },
  { code: 'actions.delete', moduleCode: 'actions', name: 'Excluir acao', criticality: 'high' },
  { code: 'actions.complete', moduleCode: 'actions', name: 'Finalizar acao' },
  { code: 'actions.reopen', moduleCode: 'actions', name: 'Reabrir acao' },
  { code: 'actions.export', moduleCode: 'actions', name: 'Exportar relatorio' },
  { code: 'risks.create', moduleCode: 'risks', name: 'Registrar risco' },
  { code: 'risks.update', moduleCode: 'risks', name: 'Editar risco' },
  { code: 'risks.delete', moduleCode: 'risks', name: 'Excluir risco', criticality: 'high' },
  { code: 'nonconformities.create', moduleCode: 'nonconformities', name: 'Registrar nao conformidade' },
  { code: 'nonconformities.update', moduleCode: 'nonconformities', name: 'Editar nao conformidade' },
  { code: 'nonconformities.delete', moduleCode: 'nonconformities', name: 'Excluir nao conformidade', criticality: 'high' },
  { code: 'documents.create', moduleCode: 'documents', name: 'Criar documento' },
  { code: 'documents.update', moduleCode: 'documents', name: 'Editar documento' },
  { code: 'documents.delete', moduleCode: 'documents', name: 'Excluir documento', criticality: 'high' },
  { code: 'audits.create', moduleCode: 'audits', name: 'Planejar auditoria' },
  { code: 'audits.update', moduleCode: 'audits', name: 'Executar auditoria e gerar NC' },
  { code: 'audits.delete', moduleCode: 'audits', name: 'Excluir auditoria', criticality: 'high' },
  { code: 'food-safety.manage', moduleCode: 'food-safety', name: 'Gerenciar processos, perigos e PCC' },
  { code: 'food-safety.intelligence', moduleCode: 'food-safety', name: 'Usar inteligencia em seguranca dos alimentos' },
  { code: 'automations.manage', moduleCode: 'automations', name: 'Criar e publicar fluxos', criticality: 'high' },
  { code: 'processes.create', moduleCode: 'processes', name: 'Mapear processo' },
  { code: 'processes.update', moduleCode: 'processes', name: 'Editar SIPOC e etapas' },
  { code: 'processes.delete', moduleCode: 'processes', name: 'Excluir processo', criticality: 'high' },
  { code: 'asset-security.entry', moduleCode: 'asset-security', name: 'Registrar entrada' },
  { code: 'asset-security.exit', moduleCode: 'asset-security', name: 'Registrar saida' },
  { code: 'asset-security.authorize', moduleCode: 'asset-security', name: 'Gerenciar autorizacoes' },
  { code: 'asset-security.rounds', moduleCode: 'asset-security', name: 'Executar rondas' },
  { code: 'asset-security.offline', moduleCode: 'asset-security', name: 'Operacao offline', criticality: 'high' },
  { code: 'compensation.salary.individual', moduleCode: 'compensation', name: 'Visualizar salario individual', criticality: 'critical' },
  { code: 'compensation.movements.approve', moduleCode: 'compensation', name: 'Aprovar movimentacoes', criticality: 'high' },
  { code: 'compensation.export', moduleCode: 'compensation', name: 'Exportar dados de cargos e salarios', criticality: 'high' },
  { code: 'forms.create', moduleCode: 'forms', name: 'Criar formulario/checklist' },
  { code: 'forms.update', moduleCode: 'forms', name: 'Editar campos e registrar preenchimento' },
  { code: 'forms.delete', moduleCode: 'forms', name: 'Excluir formulario', criticality: 'high' },
  { code: 'meetings.invite', moduleCode: 'meetings', name: 'Enviar convite ICS' },
  { code: 'reports.export', moduleCode: 'reports', name: 'Exportar relatorios' },
  { code: 'prize.admin', moduleCode: 'prize', name: 'Administrar configuracoes do premio', criticality: 'high' },
  { code: 'prize.connectors', moduleCode: 'prize', name: 'Gerenciar conectores do premio', criticality: 'high' },
  { code: 'prize.reports', moduleCode: 'prize', name: 'Visualizar relatorios do premio' },
];
