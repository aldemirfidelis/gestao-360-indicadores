/**
 * Catálogo-semente do registro do portal. Fonte para popular Portal{Module,Page,Feature}.
 * O sync é ADITIVO (upsert por code) e NUNCA apaga overrides do Super Admin.
 * Reflete as rotas em apps/web/app/(app)/* e os grupos de navigation.ts.
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
}

export interface CatalogFeature {
  code: string;
  moduleCode: string;
  name: string;
  criticality?: 'low' | 'medium' | 'high' | 'critical';
}

export const CATALOG_MODULES: CatalogModule[] = [
  { code: 'communication', name: 'Comunicacao', category: 'Comunicacao', route: '/comunicacao', menuOrder: 8, criticality: 'medium' },
  { code: 'directory', name: 'Pessoas', category: 'Comunicacao', route: '/pessoas', menuOrder: 9, criticality: 'low' },
  { code: 'integrations', name: 'Integracoes', category: 'Comunicacao', route: '/integracoes', menuOrder: 10, criticality: 'medium' },
  { code: 'help-center', name: 'Central de Ajuda', category: 'Comunicacao', route: '/ajuda', menuOrder: 11, criticality: 'low' },
  { code: 'dashboard', name: 'Dashboard', category: 'Visualizações', route: '/dashboard', menuOrder: 1, criticality: 'medium' },
  { code: 'visualization', name: 'Dashboard Executivo', category: 'Visualizações', route: '/visualization', menuOrder: 2, criticality: 'low' },
  { code: 'org', name: 'Árvore Organizacional', category: 'Visualizações', route: '/org', menuOrder: 3, criticality: 'medium' },
  { code: 'strategy', name: 'Mapa Estratégico', category: 'Visualizações', route: '/strategy', menuOrder: 4, criticality: 'medium' },
  { code: 'indicators', name: 'Indicadores', category: 'Visualizações', route: '/indicators', menuOrder: 5, criticality: 'high' },
  { code: 'projects', name: 'Cronogramas', category: 'Visualizações', route: '/projects', menuOrder: 6, criticality: 'low' },
  { code: 'insights', name: 'Insights', category: 'Visualizações', route: '/insights', menuOrder: 7, criticality: 'low' },
  { code: 'deviations', name: 'Análise de Causa', category: 'Lançamentos', route: '/deviations', menuOrder: 8, criticality: 'medium' },
  { code: 'treatments', name: 'Tratativas', category: 'Lançamentos', route: '/treatments', menuOrder: 9, criticality: 'medium' },
  { code: 'imports', name: 'Registrar Evidência', category: 'Lançamentos', route: '/imports', menuOrder: 10, criticality: 'low' },
  { code: 'organograma', name: 'Organograma', category: 'Gestão', route: '/organograma', menuOrder: 11, criticality: 'medium' },
  { code: 'aprovacoes-cargo', name: 'Aprovações', category: 'Gestão', route: '/aprovacoes-cargo', menuOrder: 12, criticality: 'medium' },
  { code: 'eficacia', name: 'Análise de Eficácia', category: 'Gestão', route: '/eficacia', menuOrder: 13, criticality: 'medium' },
  { code: 'periods', name: 'Períodos', category: 'Gestão', route: '/periods', menuOrder: 14, criticality: 'high' },
  { code: 'actions', name: 'Plano de Ação', category: 'Gestão', route: '/actions', menuOrder: 15, criticality: 'high' },
  { code: 'meetings', name: 'Reuniões', category: 'Gestão', route: '/meetings', menuOrder: 16, criticality: 'low' },
  { code: 'okrs', name: 'OKRs', category: 'Gestão', route: '/okrs', menuOrder: 17, criticality: 'low' },
  { code: 'risks', name: 'Riscos', category: 'Gestão', route: '/risks', menuOrder: 18, criticality: 'high' },
  { code: 'nonconformities', name: 'Não Conformidades', category: 'Gestão', route: '/nonconformities', menuOrder: 18, criticality: 'high' },
  { code: 'documents', name: 'Documentos', category: 'Gestão', route: '/documents', menuOrder: 18, criticality: 'medium' },
  { code: 'audits', name: 'Auditorias', category: 'Gestão', route: '/audits', menuOrder: 18, criticality: 'high' },
  { code: 'processes', name: 'Processos', category: 'Gestão', route: '/processes', menuOrder: 18, criticality: 'medium' },
  { code: 'forms', name: 'Formularios', category: 'Gestão', route: '/forms', menuOrder: 18, criticality: 'medium' },
  { code: 'prize', name: 'Gestão de Prêmio', description: 'Remuneração variável: anexos, competências, apuração, folha e espelho', category: 'Gestão de Prêmio', route: '/gestao-premio', menuOrder: 19, criticality: 'high' },
  { code: 'reports', name: 'Relatórios e Exportações', category: 'Relatórios', route: '/reports', menuOrder: 18, criticality: 'medium' },
  { code: 'audit', name: 'Auditoria', category: 'Relatórios', route: '/audit', menuOrder: 19, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'users', name: 'Usuários e Permissões', category: 'Configurações', route: '/users', menuOrder: 20, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'settings', name: 'Configurações', category: 'Configurações', route: '/settings', menuOrder: 21, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'database-admin', name: 'Administração do Banco', category: 'Configurações', route: '/settings/database', menuOrder: 22, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'portal-admin', name: 'Central de Administração do Portal', category: 'Configurações', route: '/settings/portal', menuOrder: 23, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'auth', name: 'Autenticação', category: 'Sistema', menuOrder: 99, criticality: 'critical', systemRequired: true, nonBlockable: true },
  { code: 'access-control', name: 'Controle de Acesso', category: 'Sistema', menuOrder: 100, criticality: 'critical', systemRequired: true, nonBlockable: true },
];

export const CATALOG_PAGES: CatalogPage[] = [
  { code: 'communication.main', moduleCode: 'communication', name: 'Comunicacao', title: 'Comunicacao', route: '/comunicacao' },
  { code: 'directory.list', moduleCode: 'directory', name: 'Pessoas', title: 'Pessoas', route: '/pessoas' },
  { code: 'integrations.main', moduleCode: 'integrations', name: 'Integracoes', title: 'Integracoes', route: '/integracoes' },
  { code: 'help-center.main', moduleCode: 'help-center', name: 'Central de Ajuda', title: 'Central de Ajuda', route: '/ajuda' },
  { code: 'indicators.list', moduleCode: 'indicators', name: 'Indicadores', title: 'Indicadores', route: '/indicators' },
  { code: 'indicators.detail', moduleCode: 'indicators', name: 'Detalhe do indicador', title: 'Indicador', route: '/indicators/[id]' },
  { code: 'actions.list', moduleCode: 'actions', name: 'Planos de Ação', title: 'Planos de Ação', route: '/actions' },
  { code: 'risks.list', moduleCode: 'risks', name: 'Riscos', title: 'Registro de Riscos', route: '/risks' },
  { code: 'nonconformities.list', moduleCode: 'nonconformities', name: 'Não Conformidades', title: 'Não Conformidades', route: '/nonconformities' },
  { code: 'documents.list', moduleCode: 'documents', name: 'Documentos', title: 'Gestão Documental', route: '/documents' },
  { code: 'audits.list', moduleCode: 'audits', name: 'Auditorias', title: 'Auditorias e Compliance', route: '/audits' },
  { code: 'processes.list', moduleCode: 'processes', name: 'Processos', title: 'Processos e SIPOC', route: '/processes' },
  { code: 'forms.list', moduleCode: 'forms', name: 'Formularios', title: 'Formularios e Checklists', route: '/forms' },
  { code: 'reports.list', moduleCode: 'reports', name: 'Relatórios', title: 'Relatórios e Exportações', route: '/reports' },
  { code: 'prize.overview', moduleCode: 'prize', name: 'Visão Geral do Prêmio', title: 'Gestão de Prêmio', route: '/gestao-premio' },
  { code: 'prize.programs', moduleCode: 'prize', name: 'Programas de Prêmio', title: 'Programas de Prêmio', route: '/gestao-premio/programas' },
  { code: 'prize.competences', moduleCode: 'prize', name: 'Competências', title: 'Competências', route: '/gestao-premio/competencias' },
  { code: 'prize.annexes', moduleCode: 'prize', name: 'Anexos e Regras', title: 'Anexos e Regras', route: '/gestao-premio/anexos' },
  { code: 'prize.indicators', moduleCode: 'prize', name: 'Indicadores do Prêmio', title: 'Indicadores do Prêmio', route: '/gestao-premio/indicadores' },
  { code: 'prize.actuals', moduleCode: 'prize', name: 'Lançamento do Realizado', title: 'Lançamento do Realizado', route: '/gestao-premio/realizado' },
  { code: 'prize.previsto-realizado', moduleCode: 'prize', name: 'Previsto x Realizado', title: 'Previsto x Realizado', route: '/gestao-premio/previsto-realizado' },
  { code: 'prize.eligible', moduleCode: 'prize', name: 'Colaboradores Elegíveis', title: 'Colaboradores Elegíveis', route: '/gestao-premio/colaboradores' },
  { code: 'prize.connectors', moduleCode: 'prize', name: 'Integrações do Prêmio', title: 'Integrações do Prêmio', route: '/gestao-premio/integracoes' },
  { code: 'prize.calc', moduleCode: 'prize', name: 'Apuração Mensal', title: 'Apuração Mensal', route: '/gestao-premio/apuracao' },
  { code: 'prize.moderators', moduleCode: 'prize', name: 'Moderadores', title: 'Moderadores', route: '/gestao-premio/moderadores' },
  { code: 'settings.main', moduleCode: 'settings', name: 'Configurações', title: 'Configurações', route: '/settings' },
  { code: 'database-admin.main', moduleCode: 'database-admin', name: 'Administração do Banco', title: 'Banco de Dados', route: '/settings/database' },
  { code: 'portal-admin.main', moduleCode: 'portal-admin', name: 'Central do Portal', title: 'Central de Administração do Portal', route: '/settings/portal' },
];

export const CATALOG_FEATURES: CatalogFeature[] = [
  { code: 'communication.attachments', moduleCode: 'communication', name: 'Enviar anexos em mensagens' },
  { code: 'communication.mute', moduleCode: 'communication', name: 'Silenciar conversas' },
  { code: 'communication.pin', moduleCode: 'communication', name: 'Fixar conversas' },
  { code: 'integrations.preference', moduleCode: 'integrations', name: 'Configurar preferencias de integracao' },
  { code: 'help-center.feedback', moduleCode: 'help-center', name: 'Registrar feedback de artigo' },
  { code: 'help-center.manage', moduleCode: 'help-center', name: 'Administrar artigos da ajuda', criticality: 'medium' },
  { code: 'indicators.create', moduleCode: 'indicators', name: 'Criar indicador' },
  { code: 'indicators.update', moduleCode: 'indicators', name: 'Editar indicador' },
  { code: 'indicators.delete', moduleCode: 'indicators', name: 'Excluir indicador', criticality: 'high' },
  { code: 'indicators.launch', moduleCode: 'indicators', name: 'Lançar resultado' },
  { code: 'indicators.import', moduleCode: 'indicators', name: 'Importar resultados' },
  { code: 'indicators.export', moduleCode: 'indicators', name: 'Exportar relatório' },
  { code: 'indicators.history', moduleCode: 'indicators', name: 'Visualizar histórico' },
  { code: 'actions.create', moduleCode: 'actions', name: 'Criar ação' },
  { code: 'actions.update', moduleCode: 'actions', name: 'Editar ação' },
  { code: 'actions.delete', moduleCode: 'actions', name: 'Excluir ação', criticality: 'high' },
  { code: 'actions.complete', moduleCode: 'actions', name: 'Finalizar ação' },
  { code: 'actions.reopen', moduleCode: 'actions', name: 'Reabrir ação' },
  { code: 'actions.export', moduleCode: 'actions', name: 'Exportar relatório' },
  { code: 'risks.create', moduleCode: 'risks', name: 'Registrar risco' },
  { code: 'risks.update', moduleCode: 'risks', name: 'Editar risco' },
  { code: 'risks.delete', moduleCode: 'risks', name: 'Excluir risco', criticality: 'high' },
  { code: 'nonconformities.create', moduleCode: 'nonconformities', name: 'Registrar não conformidade' },
  { code: 'nonconformities.update', moduleCode: 'nonconformities', name: 'Editar não conformidade' },
  { code: 'nonconformities.delete', moduleCode: 'nonconformities', name: 'Excluir não conformidade', criticality: 'high' },
  { code: 'documents.create', moduleCode: 'documents', name: 'Criar documento' },
  { code: 'documents.update', moduleCode: 'documents', name: 'Editar documento' },
  { code: 'documents.delete', moduleCode: 'documents', name: 'Excluir documento', criticality: 'high' },
  { code: 'audits.create', moduleCode: 'audits', name: 'Planejar auditoria' },
  { code: 'audits.update', moduleCode: 'audits', name: 'Executar auditoria e gerar NC' },
  { code: 'audits.delete', moduleCode: 'audits', name: 'Excluir auditoria', criticality: 'high' },
  { code: 'processes.create', moduleCode: 'processes', name: 'Mapear processo' },
  { code: 'processes.update', moduleCode: 'processes', name: 'Editar SIPOC e etapas' },
  { code: 'processes.delete', moduleCode: 'processes', name: 'Excluir processo', criticality: 'high' },
  { code: 'forms.create', moduleCode: 'forms', name: 'Criar formulario/checklist' },
  { code: 'forms.update', moduleCode: 'forms', name: 'Editar campos e registrar preenchimento' },
  { code: 'forms.delete', moduleCode: 'forms', name: 'Excluir formulario', criticality: 'high' },
  { code: 'meetings.invite', moduleCode: 'meetings', name: 'Enviar convite ICS' },
  { code: 'reports.export', moduleCode: 'reports', name: 'Exportar relatórios' },
];
