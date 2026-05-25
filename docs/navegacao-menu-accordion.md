# Navegacao e menu accordion

Está documentação descreve a nova navegacao lateral do Gestão 360, reorganizada para separar consultas, lançamentos, gestão e relatorios, mantendo Configurações fora da operação diária.

## Objetivo

A navegacao foi reorganizada para facilitar o uso em empresas com varias unidades, gestores, setores e perfis de acesso. O menu principal agora prioriza acompanhamento e análise antes das rotinas de lançamento.

Ordem principal:

1. **Visualizações**
2. **Lançamentos**
3. **Gestão**
4. **Relatorios**

Configurações fica separada no rodape do menu lateral, acessada por icone de engrenagem, apenas para usuários autorizados.

## Estrutura do menu

### Visualizações

Agrupa telas de consulta, acompanhamento e análise:

- Visão Geral.
- Dashboard Executivo.
- Arvore Organizacional.
- Mapa Estratégico.
- Indicadores.
- Cronogramas.
- Acompanhamentos.

### Lançamentos

Agrupa telas de entrada operacional:

- Central de Lançamentos.
- Lancar Resultado.
- Criar Indicador.
- Criar Área Macro.
- Criar Área Micro.
- Criar Diretriz.
- Criar Análise de Causa.
- Registrar Evidencia.

### Gestão

Agrupa cadastros e objetos de gestão do dia a dia:

- Estrutura Organizacional.
- Objetivos Estratégicos.
- Plano de Ação.
- Reuniões.
- Análise de Causa.
- Indicadores.
- OKRs.
- Projetos e Cronogramas.
- Responsáveis.

### Relatorios

Agrupa consultas analiticas, auditoria e exportações:

- Relatorios e Exportações.
- Auditoria.

## Configurações separadas

Configurações nao faz parte dos grupos operacionais. Ela aparece no rodape do menu lateral com icone de engrenagem.

A tela `/settings` funciona como uma central administrativa com cards para:

- Usuários.
- Permissões.
- Perfis de acesso.
- Auditoria.
- Parametros.
- Empresas.
- Filiais.
- Áreas e Setores.
- Notificações.
- Sistema.

Essa separacao evita misturar rotinas administrativas sensiveis com operação diária.

## Permissões

O menu e dinamico e usa as permissões retornadas por `GET /auth/me`.

As permissões podem vir de:

- Permissões diretas do usuário (`UserPermission`).
- Permissões do perfil de acesso (`AccessProfile` + `ProfilePermission`).
- Papel `SUPER_ADMIN`, que possui acesso total.

Regras importantes:

- Usuário sem permissão nao ve o item no menu.
- Usuário sem permissão de Configurações nao ve a engrenagem.
- Visualizador enxerga apenas áreas de leitura autorizadas.
- Super Admin ve todos os grupos e todas as opções.
- A exibicao no menu complementa as protecoes do backend por `@RequirePermissions(...)`.

## Responsividade

No desktop, o menu lateral usa accordion com grupos expansivos e item ativo destacado.

No mobile, o menu abre como drawer lateral a partir do botão de menu da topbar. O mesmo componente accordion e reutilizado, preservando permissão, grupo aberto e destaque da rota atual.

Existe também uma barra inferior compacta para rotas principais em telas pequenas, filtrada pelas mesmas permissões.

## Implementacao

Arquivos principais:

- `apps/web/components/shell/navigation.ts`: configuração central dos grupos, itens, rotas, icones e permissões.
- `apps/web/components/shell/accordion-navigation.tsx`: componente reutilizavel de accordion.
- `apps/web/components/shell/sidebar.tsx`: menu lateral desktop com modo recolhido.
- `apps/web/components/shell/topbar.tsx`: drawer mobile com o mesmo accordion.
- `apps/web/components/shell/mobile-nav.tsx`: navegacao inferior mobile filtrada por permissão.
- `apps/web/app/(app)/settings/page.tsx`: central administrativa separada.
- `apps/api/src/modules/auth/auth.service.ts`: perfil autenticado com permissões consolidadas.

## Validação recomendada

1. Entrar como Super Admin e confirmar todos os grupos visiveis.
2. Entrar como usuário comum e confirmar que Configurações e itens restritos nao aparecem.
3. Abrir e fechar os accordions.
4. Navegar entre rotas e conferir o item ativo.
5. Testar o modo recolhido no desktop.
6. Testar drawer e barra inferior em mobile.
7. Confirmar que `/settings` continua protegida por permissão.
8. Confirmar que as rotas antigas continuam funcionando.

## Deploy

O build de produção deve ser executado apenas no Droplet DigitalOcean, seguindo o fluxo de deploy do projeto.
