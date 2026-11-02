-- Corrige somente textos padrão ainda idênticos ao catálogo anterior.
-- Chaves, permissões concedidas, estados e personalizações são preservados.
BEGIN;

-- Permission.description: 101 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('risks:update', 'Editar riscos e planos de mitigacao', 'Editar riscos e planos de mitigação'),
    ('nc:view', 'Visualizar nao conformidades', 'Visualizar não conformidades'),
    ('nc:create', 'Registrar nao conformidades', 'Registrar não conformidades'),
    ('nc:update', 'Editar nao conformidades e acoes corretivas', 'Editar não conformidades e ações corretivas'),
    ('nc:delete', 'Excluir nao conformidades', 'Excluir não conformidades'),
    ('nc:manage', 'Gerenciar nao conformidades', 'Gerenciar não conformidades'),
    ('doc:update', 'Editar documentos e revisoes', 'Editar documentos e revisões'),
    ('doc:manage', 'Gerenciar gestao documental', 'Gerenciar gestão documental'),
    ('doc:download_docx', 'Baixar DOCX editavel', 'Baixar DOCX editável'),
    ('doc:types', 'Configurar tipos e codigos de documentos', 'Configurar tipos e códigos de documentos'),
    ('audits:view', 'Visualizar auditorias e constatacoes', 'Visualizar auditorias e constatações'),
    ('audits:update', 'Executar auditorias, constatacoes e gerar NCs', 'Executar auditorias, constatações e gerar NCs'),
    ('audits:findings', 'Registrar e classificar constatacoes', 'Registrar e classificar constatações'),
    ('audits:evidence', 'Anexar e consultar evidencias de auditoria', 'Anexar e consultar evidências de auditoria'),
    ('audits:approve', 'Aprovar auditorias e relatorios', 'Aprovar auditorias e relatórios'),
    ('audits:export', 'Exportar auditorias e relatorios', 'Exportar auditorias e relatórios'),
    ('audits:universe', 'Gerenciar universo auditavel e criterios de risco', 'Gerenciar universo auditável e critérios de risco'),
    ('audits:auditors', 'Gerenciar auditores, competencias e conflitos', 'Gerenciar auditores, competências e conflitos'),
    ('audits:checklists', 'Gerenciar modelos e execucoes de checklist', 'Gerenciar modelos e execuções de checklist'),
    ('audits:reports', 'Gerar e revisar relatorios de auditoria', 'Gerar e revisar relatórios de auditoria'),
    ('audits:followup', 'Gerenciar follow-up e verificacao de eficacia', 'Gerenciar follow-up e verificação de eficácia'),
    ('fsms:view', 'Visualizar Seguranca dos Alimentos', 'Visualizar Segurança dos Alimentos'),
    ('fsms:create', 'Criar registros de Seguranca dos Alimentos', 'Criar registros de Segurança dos Alimentos'),
    ('fsms:update', 'Editar registros de Seguranca dos Alimentos', 'Editar registros de Segurança dos Alimentos'),
    ('fsms:delete', 'Excluir registros de Seguranca dos Alimentos', 'Excluir registros de Segurança dos Alimentos'),
    ('fsms:approve', 'Aprovar/publicar registros de Seguranca dos Alimentos', 'Aprovar/publicar registros de Segurança dos Alimentos'),
    ('fsms:manage', 'Gerenciar o modulo de Seguranca dos Alimentos', 'Gerenciar o módulo de Segurança dos Alimentos'),
    ('fsms:export', 'Exportar dados de Seguranca dos Alimentos', 'Exportar dados de Segurança dos Alimentos'),
    ('asset-security:view', 'Visualizar Seguranca Patrimonial e Portarias', 'Visualizar Segurança Patrimonial e Portarias'),
    ('asset-security:create', 'Criar cadastros de portaria, pessoas e veiculos', 'Criar cadastros de portaria, pessoas e veículos'),
    ('asset-security:manage', 'Configurar pacote, regras, documentos e parametros', 'Configurar pacote, regras, documentos e parâmetros'),
    ('asset-security:approve', 'Aprovar autorizacoes e excecoes de acesso', 'Aprovar autorizações e exceções de acesso'),
    ('asset-security:authorize', 'Solicitar e manter autorizacoes de acesso', 'Solicitar e manter autorizações de acesso'),
    ('asset-security:exit', 'Registrar saidas na portaria', 'Registrar saídas na portaria'),
    ('asset-security:block', 'Gerenciar listas de bloqueio e restricoes', 'Gerenciar listas de bloqueio e restrições'),
    ('asset-security:incident', 'Registrar e tratar ocorrencias patrimoniais', 'Registrar e tratar ocorrências patrimoniais'),
    ('asset-security:qrcode', 'Emitir e validar QR Codes de seguranca', 'Emitir e validar QR Codes de segurança'),
    ('asset-security:emergency', 'Acessar relatorio de emergencia de presentes', 'Acessar relatório de emergência de presentes'),
    ('asset-security:export', 'Exportar relatorios de seguranca patrimonial', 'Exportar relatórios de segurança patrimonial'),
    ('forms:view', 'Visualizar formularios e checklists', 'Visualizar formulários e checklists'),
    ('forms:create', 'Criar formularios e checklists', 'Criar formulários e checklists'),
    ('forms:update', 'Editar formularios e registrar preenchimentos', 'Editar formulários e registrar preenchimentos'),
    ('forms:delete', 'Excluir formularios', 'Excluir formulários'),
    ('forms:manage', 'Gerenciar formularios e checklists', 'Gerenciar formulários e checklists'),
    ('forms:dashboard', 'Visualizar painel de formularios', 'Visualizar painel de formulários'),
    ('forms:builder', 'Usar construtor de formularios', 'Usar construtor de formulários'),
    ('forms:versions', 'Criar e revisar versoes de templates', 'Criar e revisar versões de templates'),
    ('forms:publish', 'Publicar templates de formulario', 'Publicar templates de formulário'),
    ('forms:fill', 'Preencher formularios e checklists em campo', 'Preencher formulários e checklists em campo'),
    ('forms:execute', 'Programar execucoes de formularios', 'Programar execuções de formulários'),
    ('forms:evidence', 'Anexar evidencias de preenchimento', 'Anexar evidências de preenchimento'),
    ('forms:approve', 'Aprovar registros de formularios', 'Aprovar registros de formulários'),
    ('forms:issues', 'Gerenciar pendencias de formularios', 'Gerenciar pendências de formulários'),
    ('forms:export', 'Exportar formularios e registros', 'Exportar formulários e registros'),
    ('forms:kiosk', 'Gerenciar modo quiosque de formularios', 'Gerenciar modo quiosque de formulários'),
    ('forms:offline', 'Gerenciar sincronizacao offline de formularios', 'Gerenciar sincronização offline de formulários'),
    ('forms:rules', 'Configurar regras e formulas de formularios', 'Configurar regras e formulas de formulários'),
    ('forms:settings', 'Configurar parametros de formularios', 'Configurar parâmetros de formulários'),
    ('forms:ai', 'Usar IA assistiva em formularios', 'Usar IA assistiva em formulários'),
    ('pessoal:view', 'Visualizar colaboradores e prontuarios', 'Visualizar colaboradores e prontuários'),
    ('pessoal:update', 'Editar prontuario, dependentes e dossie', 'Editar prontuário, dependentes e dossie'),
    ('pessoal:delete', 'Remover registros do prontuario', 'Remover registros do prontuário'),
    ('pessoal:settings', 'Configurar numeracao de matricula e template do cracha', 'Configurar numeração de matrícula e template do crachá'),
    ('pessoal:manage', 'Administrar o servico pessoal (importacao e configuracoes)', 'Administrar o serviço pessoal (importação e configurações)'),
    ('ponto:view', 'Visualizar o proprio espelho de ponto', 'Visualizar o próprio espelho de ponto'),
    ('folha:view', 'Visualizar competencias e resumos da folha', 'Visualizar competências e resumos da folha'),
    ('folha:operate', 'Operar a folha (importar ponto, calcular, conferir memorias)', 'Operar a folha (importar ponto, calcular, conferir memórias)'),
    ('folha:params', 'Administrar rubricas e parametros legais versionados', 'Administrar rubricas e parâmetros legais versionados'),
    ('folha:bank', 'Operar pagamento bancario da folha (remessa, aprovacao, retorno)', 'Operar pagamento bancário da folha (remessa, aprovação, retorno)'),
    ('folha:accounting', 'Gerar e exportar a contabilizacao da folha', 'Gerar e exportar a contabilização da folha'),
    ('recruit:view', 'Visualizar requisicoes, vagas e candidatos', 'Visualizar requisições, vagas e candidatos'),
    ('recruit:requisition:create', 'Criar e enviar requisicoes de vaga', 'Criar e enviar requisições de vaga'),
    ('recruit:requisition:approve', 'Aprovar/reprovar requisicoes e excecoes de quadro/orcamento', 'Aprovar/reprovar requisições e exceções de quadro/orçamento'),
    ('recruit:prehire', 'Validar documentos de pre-admissao', 'Validar documentos de pré-admissão'),
    ('recruit:admit', 'Autorizar admissao e converter candidato em colaborador', 'Autorizar admissão e converter candidato em colaborador'),
    ('recruit:lgpd', 'Atender solicitacoes LGPD de candidatos (acesso/exclusao/retificacao/portabilidade)', 'Atender solicitações LGPD de candidatos (acesso/exclusão/retificação/portabilidade)'),
    ('recruit:manage', 'Administrar recrutamento (pagina de carreiras, configuracoes, pipelines e canais)', 'Administrar recrutamento (página de carreiras, configurações, pipelines e canais)'),
    ('saude:occupational', 'Agendar ASO admissional e registrar resultado clinico segregado', 'Agendar ASO admissional e registrar resultado clínico segregado'),
    ('compensation:view', 'Visualizar modulo de Cargos e Salarios', 'Visualizar módulo de Cargos e Salários'),
    ('compensation:manage', 'Administrar modulo de Cargos e Salarios', 'Administrar módulo de Cargos e Salários'),
    ('compensation:jobs:create', 'Criar cargos no catalogo corporativo', 'Criar cargos no catálogo corporativo'),
    ('compensation:jobs:approve', 'Aprovar cargos e versoes do catalogo', 'Aprovar cargos e versões do catálogo'),
    ('compensation:descriptions:view', 'Visualizar descricoes de cargos', 'Visualizar descrições de cargos'),
    ('compensation:descriptions:update', 'Elaborar e revisar descricoes de cargos', 'Elaborar e revisar descrições de cargos'),
    ('compensation:descriptions:approve', 'Aprovar e publicar descricoes de cargos', 'Aprovar e publicar descrições de cargos'),
    ('compensation:salary-table:update', 'Criar revisoes e editar tabelas salariais', 'Criar revisões e editar tabelas salariais'),
    ('compensation:salary:individual', 'Visualizar salario individual nominal', 'Visualizar salário individual nominal'),
    ('compensation:movements:view', 'Visualizar movimentacoes de pessoas e salarios', 'Visualizar movimentações de pessoas e salários'),
    ('compensation:movements:request', 'Solicitar movimentacoes de pessoas e salarios', 'Solicitar movimentações de pessoas e salários'),
    ('compensation:movements:approve', 'Aprovar movimentacoes de pessoas e salarios', 'Aprovar movimentações de pessoas e salários'),
    ('compensation:movements:execute', 'Aplicar movimentacoes aprovadas ao quadro', 'Aplicar movimentações aprovadas ao quadro'),
    ('compensation:budget:view', 'Visualizar orcamento de pessoal', 'Visualizar orçamento de pessoal'),
    ('compensation:budget:update', 'Editar orcamento de pessoal', 'Editar orçamento de pessoal'),
    ('compensation:cycles:manage', 'Criar e fechar ciclos de merito e promocao', 'Criar e fechar ciclos de mérito e promoção'),
    ('compensation:reports:view', 'Visualizar relatorios de Cargos e Salarios', 'Visualizar relatórios de Cargos e Salários'),
    ('compensation:export', 'Exportar dados de Cargos e Salarios', 'Exportar dados de Cargos e Salários'),
    ('compensation:audit:view', 'Visualizar auditoria de Cargos e Salarios', 'Visualizar auditoria de Cargos e Salários'),
    ('integrations:view', 'Visualizar integracoes disponiveis', 'Visualizar integrações disponíveis'),
    ('integrations:manage', 'Gerenciar integracoes do sistema', 'Gerenciar integrações do sistema'),
    ('company-data:view', 'Consultar dados operacionais da propria empresa', 'Consultar dados operacionais da própria empresa'),
    ('company-data:export', 'Exportar dados operacionais da propria empresa', 'Exportar dados operacionais da própria empresa')
)
UPDATE "Permission" AS catalog
SET "description" = corrections.corrected
FROM corrections
WHERE catalog."key" = corrections.code
  AND catalog."description" = corrections.previous;

-- Permission.module: 93 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('nc:view', 'Nao Conformidades', 'Não Conformidades'),
    ('nc:create', 'Nao Conformidades', 'Não Conformidades'),
    ('nc:update', 'Nao Conformidades', 'Não Conformidades'),
    ('nc:delete', 'Nao Conformidades', 'Não Conformidades'),
    ('nc:manage', 'Nao Conformidades', 'Não Conformidades'),
    ('fsms:view', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('fsms:create', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('fsms:update', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('fsms:delete', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('fsms:approve', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('fsms:manage', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('fsms:export', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('asset-security:view', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:create', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:update', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:manage', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:approve', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:authorize', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:entry', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:exit', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:block', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:incident', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:rounds', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:handover', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:qrcode', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:offline', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:emergency', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('asset-security:export', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('forms:view', 'Formularios', 'Formulários'),
    ('forms:create', 'Formularios', 'Formulários'),
    ('forms:update', 'Formularios', 'Formulários'),
    ('forms:delete', 'Formularios', 'Formulários'),
    ('forms:manage', 'Formularios', 'Formulários'),
    ('forms:dashboard', 'Formularios', 'Formulários'),
    ('forms:templates', 'Formularios', 'Formulários'),
    ('forms:builder', 'Formularios', 'Formulários'),
    ('forms:versions', 'Formularios', 'Formulários'),
    ('forms:publish', 'Formularios', 'Formulários'),
    ('forms:fill', 'Formularios', 'Formulários'),
    ('forms:execute', 'Formularios', 'Formulários'),
    ('forms:records', 'Formularios', 'Formulários'),
    ('forms:evidence', 'Formularios', 'Formulários'),
    ('forms:approve', 'Formularios', 'Formulários'),
    ('forms:issues', 'Formularios', 'Formulários'),
    ('forms:export', 'Formularios', 'Formulários'),
    ('forms:external', 'Formularios', 'Formulários'),
    ('forms:kiosk', 'Formularios', 'Formulários'),
    ('forms:offline', 'Formularios', 'Formulários'),
    ('forms:rules', 'Formularios', 'Formulários'),
    ('forms:settings', 'Formularios', 'Formulários'),
    ('forms:ai', 'Formularios', 'Formulários'),
    ('pessoal:view', 'Servico Pessoal', 'Serviço Pessoal'),
    ('pessoal:create', 'Servico Pessoal', 'Serviço Pessoal'),
    ('pessoal:update', 'Servico Pessoal', 'Serviço Pessoal'),
    ('pessoal:delete', 'Servico Pessoal', 'Serviço Pessoal'),
    ('pessoal:settings', 'Servico Pessoal', 'Serviço Pessoal'),
    ('pessoal:manage', 'Servico Pessoal', 'Serviço Pessoal'),
    ('ponto:view', 'Servico Pessoal', 'Serviço Pessoal'),
    ('ponto:clock', 'Servico Pessoal', 'Serviço Pessoal'),
    ('ponto:team', 'Servico Pessoal', 'Serviço Pessoal'),
    ('ponto:manage', 'Servico Pessoal', 'Serviço Pessoal'),
    ('ponto:kiosk', 'Servico Pessoal', 'Serviço Pessoal'),
    ('saude:occupational', 'Saude Ocupacional', 'Saúde Ocupacional'),
    ('compensation:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:manage', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:structure:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:jobs:create', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:jobs:update', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:jobs:approve', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:descriptions:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:descriptions:update', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:descriptions:approve', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:salary-table:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:salary-table:update', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:salary-table:approve', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:salary-fit:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:salary:individual', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:salary:mass', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:movements:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:movements:request', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:movements:approve', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:movements:execute', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:budget:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:budget:update', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:cycles:manage', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:reports:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:export', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation:audit:view', 'Cargos e Salarios', 'Cargos e Salários'),
    ('communication:attachments', 'Comunicacao', 'Comunicação'),
    ('communication:pin', 'Comunicacao', 'Comunicação'),
    ('communication:mute', 'Comunicacao', 'Comunicação'),
    ('integrations:view', 'Integracoes', 'Integrações'),
    ('integrations:manage', 'Integracoes', 'Integrações')
)
UPDATE "Permission" AS catalog
SET "module" = corrections.corrected
FROM corrections
WHERE catalog."key" = corrections.code
  AND catalog."module" = corrections.previous;

-- AccessProfile.description: 1 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('OPERADOR_DADOS', 'Consulta e exporta visoes seguras dos dados da propria empresa, sem acesso ao banco fisico ou a dados de outros clientes.', 'Consulta e exporta visões seguras dos dados da própria empresa, sem acesso ao banco físico ou a dados de outros clientes.')
)
UPDATE "AccessProfile" AS catalog
SET "description" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."description" = corrections.previous
  AND catalog."system" = true;

-- PlatformAdminPermission.description: 12 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('platform.modules.view', 'Visualizar catalogo e matriz de modulos', 'Visualizar catálogo e matriz de módulos'),
    ('platform.modules.manage', 'Liberar, bloquear e configurar modulos', 'Liberar, bloquear e configurar módulos'),
    ('platform.users.view', 'Visualizar usuarios globais', 'Visualizar usuários globais'),
    ('platform.users.manage', 'Bloquear usuarios, revogar sessoes e convites', 'Bloquear usuários, revogar sessões e convites'),
    ('platform.access_logs.view', 'Visualizar sessoes e logs de acesso', 'Visualizar sessões e logs de acesso'),
    ('platform.database.health', 'Visualizar saude e integridade do banco', 'Visualizar saúde e integridade do banco'),
    ('platform.database.restore_request', 'Solicitar restauracao controlada', 'Solicitar restauração controlada'),
    ('platform.environments.manage', 'Gerenciar ambientes, versoes e releases', 'Gerenciar ambientes, versões e releases'),
    ('platform.maintenance.manage', 'Gerenciar manutencoes da plataforma', 'Gerenciar manutenções da plataforma'),
    ('platform.integrations.manage', 'Gerenciar integracoes globais', 'Gerenciar integrações globais'),
    ('platform.internal_users.manage', 'Gerenciar usuarios internos da plataforma', 'Gerenciar usuários internos da plataforma'),
    ('platform.site_analytics.view', 'Visualizar visitantes do site e da demonstracao', 'Visualizar visitantes do site e da demonstração')
)
UPDATE "PlatformAdminPermission" AS catalog
SET "description" = corrections.corrected
FROM corrections
WHERE catalog."key" = corrections.code
  AND catalog."description" = corrections.previous;

-- PlatformAdminPermission.group: 9 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('platform.dashboard.view', 'Visao Geral', 'Visão Geral'),
    ('platform.modules.view', 'Modulos', 'Módulos'),
    ('platform.modules.manage', 'Modulos', 'Módulos'),
    ('platform.users.view', 'Usuarios', 'Usuários'),
    ('platform.users.manage', 'Usuarios', 'Usuários'),
    ('platform.access_logs.view', 'Seguranca', 'Segurança'),
    ('platform.maintenance.manage', 'Manutencao', 'Manutenção'),
    ('platform.integrations.manage', 'Integracoes', 'Integrações'),
    ('platform.internal_users.manage', 'Usuarios Internos', 'Usuários Internos')
)
UPDATE "PlatformAdminPermission" AS catalog
SET "group" = corrections.corrected
FROM corrections
WHERE catalog."key" = corrections.code
  AND catalog."group" = corrections.previous;

-- PlatformAdminRole.name: 2 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('IMPLEMENTATION_MANAGER', 'Gestor de Implantacao', 'Gestor de Implantação'),
    ('TECHNICAL_SUPPORT', 'Suporte Tecnico', 'Suporte Técnico')
)
UPDATE "PlatformAdminRole" AS catalog
SET "name" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."name" = corrections.previous
  AND catalog."system" = true;

-- PlatformAdminRole.description: 8 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('PLATFORM_OWNER', 'Acesso maximo ao Portal Admin Global.', 'Acesso máximo ao Portal Admin Global.'),
    ('SUPER_ADMIN', 'Administra empresas, modulos, usuarios internos e operacao geral.', 'Administra empresas, módulos, usuários internos e operação geral.'),
    ('IMPLEMENTATION_MANAGER', 'Configura empresas, planos iniciais e modulos autorizados.', 'Configura empresas, planos iniciais e módulos autorizados.'),
    ('TECHNICAL_SUPPORT', 'Consulta configuracoes, logs e inicia suporte somente leitura.', 'Consulta configurações, logs e inicia suporte somente leitura.'),
    ('DATABASE_ADMIN', 'Acompanha integridade, backups, migracoes e consultas controladas.', 'Acompanha integridade, backups, migrações e consultas controladas.'),
    ('DEVELOPER', 'Acessa logs tecnicos, ambientes, feature flags, jobs e diagnosticos.', 'Acessa logs técnicos, ambientes, feature flags, jobs e diagnósticos.'),
    ('COMMERCIAL_FINANCE', 'Administra planos, contratos, limites e modulos contratados.', 'Administra planos, contratos, limites e módulos contratados.'),
    ('PLATFORM_AUDITOR', 'Consulta trilhas de auditoria e historicos sem alterar dados.', 'Consulta trilhas de auditoria e históricos sem alterar dados.')
)
UPDATE "PlatformAdminRole" AS catalog
SET "description" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."description" = corrections.previous
  AND catalog."system" = true;

-- PortalModule.name: 27 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('org', 'Arvore Organizacional', 'Árvore Organizacional'),
    ('strategy', 'Mapa Estrategico', 'Mapa Estratégico'),
    ('actions', 'Plano de Acao', 'Plano de Ação'),
    ('meetings', 'Reunioes', 'Reuniões'),
    ('monthly-results', 'Reuniao Mensal', 'Reunião Mensal'),
    ('aprovacoes-cargo', 'Aprovacoes', 'Aprovações'),
    ('periods', 'Periodos', 'Períodos'),
    ('automations', 'Central de Automacoes', 'Central de Automações'),
    ('users', 'Usuarios', 'Usuários'),
    ('reports', 'Relatorios e Exportacoes', 'Relatórios e Exportações'),
    ('nonconformities', 'Nao Conformidades', 'Não Conformidades'),
    ('forms', 'Formularios', 'Formulários'),
    ('projects', 'Ata da Reuniao e Cronogramas', 'Ata da Reunião e Cronogramas'),
    ('food-safety', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('asset-security', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('compensation', 'Cargos e Salarios', 'Cargos e Salários'),
    ('recruitment', 'Recrutamento e Selecao', 'Recrutamento e Seleção'),
    ('personnel', 'Servico Pessoal', 'Serviço Pessoal'),
    ('communication', 'Comunicacao', 'Comunicação'),
    ('prize', 'Gestao de Premio', 'Gestão de Prêmio'),
    ('settings', 'Configuracoes', 'Configurações'),
    ('database-admin', 'Administracao do Banco', 'Administração do Banco'),
    ('portal-admin', 'Central de Administracao do Portal', 'Central de Administração do Portal'),
    ('integrations', 'Integracoes Globais', 'Integrações Globais'),
    ('auth', 'Autenticacao', 'Autenticação'),
    ('imports', 'Importacoes', 'Importações'),
    ('eficacia', 'Analise de Eficacia', 'Análise de Eficácia')
)
UPDATE "PortalModule" AS catalog
SET "name" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."name" = corrections.previous;

-- PortalModule.description: 11 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('projects', 'Ata integrada da reuniao mensal (acoes por area/setor/responsavel) e cronogramas de projeto', 'Ata integrada da reunião mensal (ações por área/setor/responsável) e cronogramas de projeto'),
    ('food-safety', 'FSMS, APPCC, processos, perigos, cadeia e inteligencia', 'FSMS, APPCC, processos, perigos, cadeia e inteligência'),
    ('compensation', 'Plano de cargos, quadro, tabelas salariais e movimentacoes', 'Plano de cargos, quadro, tabelas salariais e movimentações'),
    ('recruitment', 'Requisicoes de vaga, divulgacao, candidatos, propostas, pre-admissao e admissao (inclui portal publico de carreiras)', 'Requisições de vaga, divulgação, candidatos, propostas, pré-admissão e admissão (inclui portal público de carreiras)'),
    ('personnel', 'Departamento pessoal: colaboradores, ponto (inclusive totem facial), ferias, admissoes e fechamento de competencia', 'Departamento pessoal: colaboradores, ponto (inclusive totem facial), férias, admissões e fechamento de competência'),
    ('payroll', 'Motor de calculo, beneficios, rescisoes, eSocial, CNAB, obrigacoes e holerites', 'Motor de cálculo, benefícios, rescisões, eSocial, CNAB, obrigações e holerites'),
    ('procurement', 'Requisicoes, fila do comprador, pedidos, alcadas e recebimentos', 'Requisições, fila do comprador, pedidos, alçadas e recebimentos'),
    ('inventory', 'Saldos, kardex, retiradas, transferencias e alertas de reposicao', 'Saldos, kardex, retiradas, transferências e alertas de reposição'),
    ('training', 'Matriz de treinamento, turmas, pendencias, eficacia, PDI e certificados', 'Matriz de treinamento, turmas, pendências, eficácia, PDI e certificados'),
    ('prize', 'Remuneracao variavel: anexos, competencias, apuracao, folha e espelho', 'Remuneração variável: anexos, competências, apuração, folha e espelho'),
    ('service-desk', 'Chamados de suporte dos usuarios para a operacao do portal', 'Chamados de suporte dos usuários para a operação do portal')
)
UPDATE "PortalModule" AS catalog
SET "description" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."description" = corrections.previous;

-- PortalModule.category: 22 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('visualization', 'Estrategia', 'Estratégia'),
    ('org', 'Estrategia', 'Estratégia'),
    ('strategy', 'Estrategia', 'Estratégia'),
    ('indicators', 'Estrategia', 'Estratégia'),
    ('deviations', 'Estrategia', 'Estratégia'),
    ('actions', 'Estrategia', 'Estratégia'),
    ('meetings', 'Estrategia', 'Estratégia'),
    ('monthly-results', 'Estrategia', 'Estratégia'),
    ('okrs', 'Estrategia', 'Estratégia'),
    ('aprovacoes-cargo', 'Administracao', 'Administração'),
    ('periods', 'Administracao', 'Administração'),
    ('automations', 'Administracao', 'Administração'),
    ('users', 'Administracao', 'Administração'),
    ('reports', 'Administracao', 'Administração'),
    ('food-safety', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('asset-security', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('compensation', 'Cargos e Salarios', 'Cargos e Salários'),
    ('recruitment', 'Recrutamento e Selecao', 'Recrutamento e Seleção'),
    ('personnel', 'Servico Pessoal', 'Serviço Pessoal'),
    ('payroll', 'Servico Pessoal', 'Serviço Pessoal'),
    ('communication', 'Comunicacao', 'Comunicação'),
    ('prize', 'Gestao de Premio', 'Gestão de Prêmio')
)
UPDATE "PortalModule" AS catalog
SET "category" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."category" = corrections.previous;

-- PlatformModuleCatalog.name: 27 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('org', 'Arvore Organizacional', 'Árvore Organizacional'),
    ('strategy', 'Mapa Estrategico', 'Mapa Estratégico'),
    ('actions', 'Plano de Acao', 'Plano de Ação'),
    ('meetings', 'Reunioes', 'Reuniões'),
    ('monthly-results', 'Reuniao Mensal', 'Reunião Mensal'),
    ('aprovacoes-cargo', 'Aprovacoes', 'Aprovações'),
    ('periods', 'Periodos', 'Períodos'),
    ('automations', 'Central de Automacoes', 'Central de Automações'),
    ('users', 'Usuarios', 'Usuários'),
    ('reports', 'Relatorios e Exportacoes', 'Relatórios e Exportações'),
    ('nonconformities', 'Nao Conformidades', 'Não Conformidades'),
    ('forms', 'Formularios', 'Formulários'),
    ('projects', 'Ata da Reuniao e Cronogramas', 'Ata da Reunião e Cronogramas'),
    ('food-safety', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('asset-security', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('compensation', 'Cargos e Salarios', 'Cargos e Salários'),
    ('recruitment', 'Recrutamento e Selecao', 'Recrutamento e Seleção'),
    ('personnel', 'Servico Pessoal', 'Serviço Pessoal'),
    ('communication', 'Comunicacao', 'Comunicação'),
    ('prize', 'Gestao de Premio', 'Gestão de Prêmio'),
    ('settings', 'Configuracoes', 'Configurações'),
    ('database-admin', 'Administracao do Banco', 'Administração do Banco'),
    ('portal-admin', 'Central de Administracao do Portal', 'Central de Administração do Portal'),
    ('integrations', 'Integracoes Globais', 'Integrações Globais'),
    ('auth', 'Autenticacao', 'Autenticação'),
    ('imports', 'Importacoes', 'Importações'),
    ('eficacia', 'Analise de Eficacia', 'Análise de Eficácia')
)
UPDATE "PlatformModuleCatalog" AS catalog
SET "name" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."name" = corrections.previous;

-- PlatformModuleCatalog.description: 11 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('projects', 'Ata integrada da reuniao mensal (acoes por area/setor/responsavel) e cronogramas de projeto', 'Ata integrada da reunião mensal (ações por área/setor/responsável) e cronogramas de projeto'),
    ('food-safety', 'FSMS, APPCC, processos, perigos, cadeia e inteligencia', 'FSMS, APPCC, processos, perigos, cadeia e inteligência'),
    ('compensation', 'Plano de cargos, quadro, tabelas salariais e movimentacoes', 'Plano de cargos, quadro, tabelas salariais e movimentações'),
    ('recruitment', 'Requisicoes de vaga, divulgacao, candidatos, propostas, pre-admissao e admissao (inclui portal publico de carreiras)', 'Requisições de vaga, divulgação, candidatos, propostas, pré-admissão e admissão (inclui portal público de carreiras)'),
    ('personnel', 'Departamento pessoal: colaboradores, ponto (inclusive totem facial), ferias, admissoes e fechamento de competencia', 'Departamento pessoal: colaboradores, ponto (inclusive totem facial), férias, admissões e fechamento de competência'),
    ('payroll', 'Motor de calculo, beneficios, rescisoes, eSocial, CNAB, obrigacoes e holerites', 'Motor de cálculo, benefícios, rescisões, eSocial, CNAB, obrigações e holerites'),
    ('procurement', 'Requisicoes, fila do comprador, pedidos, alcadas e recebimentos', 'Requisições, fila do comprador, pedidos, alçadas e recebimentos'),
    ('inventory', 'Saldos, kardex, retiradas, transferencias e alertas de reposicao', 'Saldos, kardex, retiradas, transferências e alertas de reposição'),
    ('training', 'Matriz de treinamento, turmas, pendencias, eficacia, PDI e certificados', 'Matriz de treinamento, turmas, pendências, eficácia, PDI e certificados'),
    ('prize', 'Remuneracao variavel: anexos, competencias, apuracao, folha e espelho', 'Remuneração variável: anexos, competências, apuração, folha e espelho'),
    ('service-desk', 'Chamados de suporte dos usuarios para a operacao do portal', 'Chamados de suporte dos usuários para a operação do portal')
)
UPDATE "PlatformModuleCatalog" AS catalog
SET "description" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."description" = corrections.previous;

-- PlatformModuleCatalog.category: 22 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('visualization', 'Estrategia', 'Estratégia'),
    ('org', 'Estrategia', 'Estratégia'),
    ('strategy', 'Estrategia', 'Estratégia'),
    ('indicators', 'Estrategia', 'Estratégia'),
    ('deviations', 'Estrategia', 'Estratégia'),
    ('actions', 'Estrategia', 'Estratégia'),
    ('meetings', 'Estrategia', 'Estratégia'),
    ('monthly-results', 'Estrategia', 'Estratégia'),
    ('okrs', 'Estrategia', 'Estratégia'),
    ('aprovacoes-cargo', 'Administracao', 'Administração'),
    ('periods', 'Administracao', 'Administração'),
    ('automations', 'Administracao', 'Administração'),
    ('users', 'Administracao', 'Administração'),
    ('reports', 'Administracao', 'Administração'),
    ('food-safety', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('asset-security', 'Seguranca Patrimonial', 'Segurança Patrimonial'),
    ('compensation', 'Cargos e Salarios', 'Cargos e Salários'),
    ('recruitment', 'Recrutamento e Selecao', 'Recrutamento e Seleção'),
    ('personnel', 'Servico Pessoal', 'Serviço Pessoal'),
    ('payroll', 'Servico Pessoal', 'Serviço Pessoal'),
    ('communication', 'Comunicacao', 'Comunicação'),
    ('prize', 'Gestao de Premio', 'Gestão de Prêmio')
)
UPDATE "PlatformModuleCatalog" AS catalog
SET "category" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."category" = corrections.previous;

-- PortalPage.name: 92 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('org.main', 'Arvore Organizacional', 'Árvore Organizacional'),
    ('strategy.main', 'Mapa Estrategico', 'Mapa Estratégico'),
    ('strategy.detail', 'Detalhe da Estrategia', 'Detalhe da Estratégia'),
    ('actions.list', 'Plano de Acao', 'Plano de Ação'),
    ('actions.detail', 'Detalhe da Acao', 'Detalhe da Ação'),
    ('meetings.list', 'Reunioes', 'Reuniões'),
    ('meetings.detail', 'Detalhe da Reuniao', 'Detalhe da Reunião'),
    ('monthly-results.main', 'Reuniao Mensal', 'Reunião Mensal'),
    ('monthly-results.detail', 'Detalhe da Reuniao Mensal', 'Detalhe da Reunião Mensal'),
    ('approvals.main', 'Aprovacoes', 'Aprovações'),
    ('periods.main', 'Periodos', 'Períodos'),
    ('automations.flows', 'Central de Automacoes', 'Central de Automações'),
    ('automations.executions', 'Execucoes', 'Execuções'),
    ('automations.approvals', 'Aprovacoes', 'Aprovações'),
    ('automations.integrations', 'Integracoes', 'Integrações'),
    ('automations.permissions', 'Permissoes', 'Permissões'),
    ('automations.history', 'Historico', 'Histórico'),
    ('automations.settings', 'Configuracoes', 'Configurações'),
    ('users.main', 'Usuarios', 'Usuários'),
    ('reports.list', 'Relatorios e Exportacoes', 'Relatórios e Exportações'),
    ('nonconformities.list', 'Nao Conformidades', 'Não Conformidades'),
    ('forms.list', 'Formularios', 'Formulários'),
    ('projects.minutes', 'Ata da Reuniao', 'Ata da Reunião'),
    ('food-safety.overview', 'Visao Geral', 'Visão Geral'),
    ('food-safety.intelligence', 'Inteligencia', 'Inteligência'),
    ('asset-security.operation', 'Operacao', 'Operação'),
    ('asset-security.people', 'Pessoas e Veiculos', 'Pessoas e Veículos'),
    ('asset-security.authorizations', 'Autorizacoes', 'Autorizações'),
    ('asset-security.rounds', 'Rondas e Ocorrencias', 'Rondas e Ocorrências'),
    ('asset-security.settings', 'Configuracoes', 'Configurações'),
    ('compensation.overview', 'Visao Geral', 'Visão Geral'),
    ('compensation.org-chart', 'Organograma de Posicoes', 'Organograma de Posições'),
    ('compensation.jobs', 'Catalogo de Cargos', 'Catálogo de Cargos'),
    ('compensation.descriptions', 'Descricoes', 'Descrições'),
    ('compensation.movements', 'Movimentacoes', 'Movimentações'),
    ('compensation.cycles', 'Ciclos de Merito', 'Ciclos de Mérito'),
    ('compensation.budget', 'Orcamento de Pessoal', 'Orçamento de Pessoal'),
    ('compensation.simulations', 'Simulacoes', 'Simulações'),
    ('compensation.approvals', 'Aprovacoes', 'Aprovações'),
    ('compensation.settings', 'Configuracoes', 'Configurações'),
    ('compensation.reports', 'Relatorios', 'Relatórios'),
    ('recruitment.requisitions', 'Requisicoes e Aprovacoes', 'Requisições e Aprovações'),
    ('recruitment.career-page', 'Pagina de Carreiras', 'Página de Carreiras'),
    ('recruitment.analytics', 'Analises de Recrutamento', 'Análises de Recrutamento'),
    ('recruitment.communication', 'Comunicacao com Candidatos', 'Comunicação com Candidatos'),
    ('recruitment.careers', 'Portal de Carreiras (publico)', 'Portal de Carreiras (público)'),
    ('personnel.overview', 'Visao Geral', 'Visão Geral'),
    ('personnel.vacations', 'Ferias e Afastamentos', 'Férias e Afastamentos'),
    ('personnel.lifecycle', 'Admissao, Desligamento e ASO', 'Admissão, Desligamento e ASO'),
    ('personnel.reports', 'Relatorios de DP', 'Relatórios de DP'),
    ('personnel.settings', 'Configuracoes do DP', 'Configurações do DP'),
    ('payroll.runs', 'Lotes de Calculo', 'Lotes de Cálculo'),
    ('payroll.benefits', 'Beneficios e Descontos', 'Benefícios e Descontos'),
    ('payroll.terminations', 'Rescisoes', 'Rescisões'),
    ('payroll.vacations', 'Ferias na Folha', 'Férias na Folha'),
    ('payroll.thirteenth', '13o Salario', '13o Salário'),
    ('payroll.params', 'Parametros de Folha', 'Parâmetros de Folha'),
    ('payroll.bank', 'Remessa Bancaria (CNAB)', 'Remessa Bancária (CNAB)'),
    ('payroll.obligations', 'Obrigacoes Trabalhistas', 'Obrigações Trabalhistas'),
    ('payroll.analytics', 'Gestao a Vista da Folha', 'Gestão a Vista da Folha'),
    ('procurement.requisitions', 'Requisicoes', 'Requisições'),
    ('communication.overview', 'Visao Geral', 'Visão Geral'),
    ('communication.publications', 'Publicacoes', 'Publicações'),
    ('communication.create', 'Criar Publicacao', 'Criar Publicação'),
    ('communication.media', 'Biblioteca de Midias', 'Biblioteca de Mídias'),
    ('communication.settings', 'Configuracoes', 'Configurações'),
    ('communication.employee-feed', 'Comunicacao Interna (colaborador)', 'Comunicação Interna (colaborador)'),
    ('training.overview', 'Visao Geral', 'Visão Geral'),
    ('training.pending', 'Pendencias e Vencimentos', 'Pendências e Vencimentos'),
    ('training.development', 'Eficacia e PDI', 'Eficácia e PDI'),
    ('training.reports', 'Relatorios de Treinamento', 'Relatórios de Treinamento'),
    ('prize.overview', 'Visao Geral do Premio', 'Visão Geral do Prêmio'),
    ('prize.programs', 'Programas de Premio', 'Programas de Prêmio'),
    ('prize.competences', 'Competencias', 'Competências'),
    ('prize.indicators', 'Indicadores do Premio', 'Indicadores do Prêmio'),
    ('prize.eligible', 'Colaboradores Elegiveis', 'Colaboradores Elegíveis'),
    ('prize.calc', 'Apuracao Mensal', 'Apuração Mensal'),
    ('prize.adjustments', 'Ajustes e Excecoes', 'Ajustes e Exceções'),
    ('prize.payslips', 'Espelhos do Premio', 'Espelhos do Prêmio'),
    ('prize.reports', 'Relatorio e Auditoria', 'Relatório e Auditoria'),
    ('prize.audit', 'Auditoria do Premio', 'Auditoria do Prêmio'),
    ('prize.payroll', 'Integracao com a Folha', 'Integração com a Folha'),
    ('prize.integrations', 'Integracoes Operacionais', 'Integrações Operacionais'),
    ('prize.connectors', 'Integracoes do Premio', 'Integrações do Prêmio'),
    ('settings.main', 'Configuracoes', 'Configurações'),
    ('database-admin.main', 'Administracao do Banco', 'Administração do Banco'),
    ('database-admin.indexes', 'Indices', 'Índices'),
    ('database-admin.import-export', 'Importacao e Exportacao', 'Importação e Exportação'),
    ('database-admin.diagnostics', 'Diagnosticos', 'Diagnósticos'),
    ('database-admin.advanced', 'Avancado', 'Avançado'),
    ('integrations.main', 'Integracoes', 'Integrações'),
    ('forms.scan', 'Leitor de Formularios', 'Leitor de Formulários')
)
UPDATE "PortalPage" AS catalog
SET "name" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."name" = corrections.previous;

-- PortalPage.title: 95 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('org.main', 'Arvore Organizacional', 'Árvore Organizacional'),
    ('strategy.main', 'Mapa Estrategico', 'Mapa Estratégico'),
    ('strategy.detail', 'Objetivo Estrategico', 'Objetivo Estratégico'),
    ('actions.list', 'Plano de Acao', 'Plano de Ação'),
    ('actions.detail', 'Acao', 'Ação'),
    ('meetings.list', 'Reunioes', 'Reuniões'),
    ('meetings.detail', 'Reuniao', 'Reunião'),
    ('monthly-results.main', 'Reuniao Mensal', 'Reunião Mensal'),
    ('approvals.main', 'Aprovacoes', 'Aprovações'),
    ('periods.main', 'Periodos', 'Períodos'),
    ('automations.flows', 'Automacoes', 'Automações'),
    ('automations.flow-list', 'Fluxos de Automacao', 'Fluxos de Automação'),
    ('automations.library', 'Biblioteca de Automacoes', 'Biblioteca de Automações'),
    ('automations.models', 'Modelos de Automacao', 'Modelos de Automação'),
    ('automations.executions', 'Execucoes de Automacao', 'Execuções de Automação'),
    ('automations.approvals', 'Aprovacoes de Automacao', 'Aprovações de Automação'),
    ('automations.tasks', 'Tarefas de Automacao', 'Tarefas de Automação'),
    ('automations.failures', 'Falhas de Automacao', 'Falhas de Automação'),
    ('automations.integrations', 'Integracoes de Automacao', 'Integrações de Automação'),
    ('automations.permissions', 'Permissoes de Automacao', 'Permissões de Automação'),
    ('automations.history', 'Historico de Automacao', 'Histórico de Automação'),
    ('automations.settings', 'Configuracoes de Automacao', 'Configurações de Automação'),
    ('users.main', 'Usuarios', 'Usuários'),
    ('reports.list', 'Relatorios e Exportacoes', 'Relatórios e Exportações'),
    ('nonconformities.list', 'Nao Conformidades', 'Não Conformidades'),
    ('documents.list', 'Gestao Documental', 'Gestão Documental'),
    ('forms.list', 'Formularios e Checklists', 'Formulários e Checklists'),
    ('projects.minutes', 'Ata da Reuniao Mensal', 'Ata da Reunião Mensal'),
    ('food-safety.overview', 'Seguranca dos Alimentos', 'Segurança dos Alimentos'),
    ('food-safety.intelligence', 'Inteligencia', 'Inteligência'),
    ('asset-security.operation', 'Operacao', 'Operação'),
    ('asset-security.people', 'Pessoas e Veiculos', 'Pessoas e Veículos'),
    ('asset-security.authorizations', 'Autorizacoes', 'Autorizações'),
    ('asset-security.rounds', 'Rondas e Ocorrencias', 'Rondas e Ocorrências'),
    ('asset-security.settings', 'Configuracoes', 'Configurações'),
    ('compensation.overview', 'Cargos e Salarios', 'Cargos e Salários'),
    ('compensation.jobs', 'Catalogo de Cargos', 'Catálogo de Cargos'),
    ('compensation.descriptions', 'Descricoes', 'Descrições'),
    ('compensation.movements', 'Movimentacoes', 'Movimentações'),
    ('compensation.cycles', 'Ciclos de Merito', 'Ciclos de Mérito'),
    ('compensation.budget', 'Orcamento de Pessoal', 'Orçamento de Pessoal'),
    ('compensation.simulations', 'Simulacoes', 'Simulações'),
    ('compensation.approvals', 'Aprovacoes', 'Aprovações'),
    ('compensation.settings', 'Configuracoes', 'Configurações'),
    ('compensation.reports', 'Relatorios', 'Relatórios'),
    ('recruitment.requisitions', 'Requisicoes e Aprovacoes', 'Requisições e Aprovações'),
    ('recruitment.career-page', 'Pagina de Carreiras', 'Página de Carreiras'),
    ('recruitment.analytics', 'Analises de Recrutamento', 'Análises de Recrutamento'),
    ('recruitment.communication', 'Comunicacao com Candidatos', 'Comunicação com Candidatos'),
    ('personnel.overview', 'Servico Pessoal', 'Serviço Pessoal'),
    ('personnel.vacations', 'Ferias e Afastamentos', 'Férias e Afastamentos'),
    ('personnel.lifecycle', 'Admissao, Desligamento e ASO', 'Admissão, Desligamento e ASO'),
    ('personnel.reports', 'Relatorios de DP', 'Relatórios de DP'),
    ('personnel.settings', 'Configuracoes do Servico Pessoal', 'Configurações do Serviço Pessoal'),
    ('payroll.benefits', 'Beneficios e Descontos', 'Benefícios e Descontos'),
    ('payroll.terminations', 'Rescisoes e Desligamentos', 'Rescisões e Desligamentos'),
    ('payroll.vacations', 'Ferias na Folha', 'Férias na Folha'),
    ('payroll.thirteenth', '13o Salario', '13o Salário'),
    ('payroll.params', 'Parametros de Folha', 'Parâmetros de Folha'),
    ('payroll.bank', 'Remessa Bancaria', 'Remessa Bancária'),
    ('payroll.obligations', 'Obrigacoes Trabalhistas', 'Obrigações Trabalhistas'),
    ('payroll.analytics', 'Gestao a Vista da Folha', 'Gestão a Vista da Folha'),
    ('procurement.requisitions', 'Requisicoes de Compra', 'Requisições de Compra'),
    ('inventory.stock', 'Posicao e Kardex', 'Posição e Kardex'),
    ('communication.overview', 'Comunicacao Interna', 'Comunicação Interna'),
    ('communication.publications', 'Publicacoes', 'Publicações'),
    ('communication.create', 'Criar Publicacao', 'Criar Publicação'),
    ('communication.media', 'Biblioteca de Midias', 'Biblioteca de Mídias'),
    ('communication.settings', 'Configuracoes da Comunicacao', 'Configurações da Comunicação'),
    ('communication.employee-feed', 'Comunicacao Interna', 'Comunicação Interna'),
    ('training.pending', 'Pendencias e Vencimentos', 'Pendências e Vencimentos'),
    ('training.catalog', 'Catalogo de Treinamentos', 'Catálogo de Treinamentos'),
    ('training.development', 'Eficacia e PDI', 'Eficácia e PDI'),
    ('training.reports', 'Relatorios', 'Relatórios'),
    ('prize.overview', 'Gestao de Premio', 'Gestão de Prêmio'),
    ('prize.programs', 'Programas de Premio', 'Programas de Prêmio'),
    ('prize.competences', 'Competencias', 'Competências'),
    ('prize.indicators', 'Indicadores do Premio', 'Indicadores do Prêmio'),
    ('prize.moderators', 'Moderadores do Premio', 'Moderadores do Prêmio'),
    ('prize.eligible', 'Colaboradores Elegiveis', 'Colaboradores Elegíveis'),
    ('prize.calc', 'Apuracao Mensal', 'Apuração Mensal'),
    ('prize.adjustments', 'Ajustes e Excecoes', 'Ajustes e Exceções'),
    ('prize.payslips', 'Espelhos do Premio', 'Espelhos do Prêmio'),
    ('prize.reports', 'Relatorio e Auditoria', 'Relatório e Auditoria'),
    ('prize.audit', 'Auditoria do Premio', 'Auditoria do Prêmio'),
    ('prize.payroll', 'Integracao com a Folha', 'Integração com a Folha'),
    ('prize.integrations', 'Integracoes do Premio', 'Integrações do Prêmio'),
    ('prize.connectors', 'Integracoes do Premio', 'Integrações do Prêmio'),
    ('settings.main', 'Configuracoes', 'Configurações'),
    ('database-admin.indexes', 'Indices do Banco', 'Índices do Banco'),
    ('database-admin.import-export', 'Importacao e Exportacao', 'Importação e Exportação'),
    ('database-admin.diagnostics', 'Diagnosticos do Banco', 'Diagnósticos do Banco'),
    ('database-admin.advanced', 'Administracao Avancada', 'Administração Avançada'),
    ('portal-admin.main', 'Central de Administracao do Portal', 'Central de Administração do Portal'),
    ('integrations.main', 'Integracoes', 'Integrações')
)
UPDATE "PortalPage" AS catalog
SET "title" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."title" = corrections.previous;

-- PortalFeature.name: 38 textos padrão.
WITH corrections (code, previous, corrected) AS (
  VALUES
    ('communication.metrics', 'Visualizar metricas de comunicacao', 'Visualizar métricas de comunicação'),
    ('integrations.preference', 'Configurar preferencias de integracao', 'Configurar preferências de integração'),
    ('indicators.launch', 'Lancar resultado', 'Lançar resultado'),
    ('indicators.export', 'Exportar relatorio', 'Exportar relatório'),
    ('indicators.history', 'Visualizar historico', 'Visualizar histórico'),
    ('actions.create', 'Criar acao', 'Criar ação'),
    ('actions.update', 'Editar acao', 'Editar ação'),
    ('actions.delete', 'Excluir acao', 'Excluir ação'),
    ('actions.complete', 'Finalizar acao', 'Finalizar ação'),
    ('actions.reopen', 'Reabrir acao', 'Reabrir ação'),
    ('actions.export', 'Exportar relatorio', 'Exportar relatório'),
    ('nonconformities.create', 'Registrar nao conformidade', 'Registrar não conformidade'),
    ('nonconformities.update', 'Editar nao conformidade', 'Editar não conformidade'),
    ('nonconformities.delete', 'Excluir nao conformidade', 'Excluir não conformidade'),
    ('food-safety.intelligence', 'Usar inteligencia em seguranca dos alimentos', 'Usar inteligência em segurança dos alimentos'),
    ('asset-security.exit', 'Registrar saida', 'Registrar saída'),
    ('asset-security.authorize', 'Gerenciar autorizacoes', 'Gerenciar autorizações'),
    ('asset-security.offline', 'Operacao offline', 'Operação offline'),
    ('compensation.salary.individual', 'Visualizar salario individual', 'Visualizar salário individual'),
    ('compensation.movements.approve', 'Aprovar movimentacoes', 'Aprovar movimentações'),
    ('compensation.export', 'Exportar dados de cargos e salarios', 'Exportar dados de cargos e salários'),
    ('recruitment.requisitions', 'Criar e aprovar requisicoes de vaga', 'Criar e aprovar requisições de vaga'),
    ('recruitment.career-page', 'Personalizar e publicar pagina de carreiras', 'Personalizar e publicar página de carreiras'),
    ('recruitment.offers', 'Aprovar propostas de contratacao', 'Aprovar propostas de contratação'),
    ('recruitment.admission', 'Converter pre-admissao em admissao', 'Converter pré-admissão em admissão'),
    ('personnel.employees', 'Administrar colaboradores e prontuarios', 'Administrar colaboradores e prontuários'),
    ('personnel.vacations', 'Administrar ferias e afastamentos', 'Administrar férias e afastamentos'),
    ('payroll.dataprev', 'Integrar obrigacoes com Dataprev', 'Integrar obrigações com Dataprev'),
    ('procurement.request', 'Criar requisicoes de compra', 'Criar requisições de compra'),
    ('procurement.buy', 'Administrar cotacoes e pedidos', 'Administrar cotações e pedidos'),
    ('procurement.approve', 'Aprovar compras por alcada', 'Aprovar compras por alçada'),
    ('inventory.operate', 'Operar recebimentos, retiradas e transferencias', 'Operar recebimentos, retiradas e transferências'),
    ('forms.create', 'Criar formulario/checklist', 'Criar formulário/checklist'),
    ('forms.delete', 'Excluir formulario', 'Excluir formulário'),
    ('reports.export', 'Exportar relatorios', 'Exportar relatórios'),
    ('prize.admin', 'Administrar configuracoes do premio', 'Administrar configurações do prêmio'),
    ('prize.connectors', 'Gerenciar conectores do premio', 'Gerenciar conectores do prêmio'),
    ('prize.reports', 'Visualizar relatorios do premio', 'Visualizar relatórios do prêmio')
)
UPDATE "PortalFeature" AS catalog
SET "name" = corrections.corrected
FROM corrections
WHERE catalog."code" = corrections.code
  AND catalog."name" = corrections.previous;

COMMIT;
