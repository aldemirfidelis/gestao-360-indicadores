# Navegacao e menu accordion

Esta documentacao descreve a nova navegacao lateral do Gestao 360, reorganizada para separar consultas, lancamentos, gestao e relatorios, mantendo Configuracoes fora da operacao diaria.

## Objetivo

A navegacao foi reorganizada para facilitar o uso em empresas com varias unidades, gestores, setores e perfis de acesso. O menu principal agora prioriza acompanhamento e analise antes das rotinas de lancamento.

Ordem principal:

1. **Visualizacoes**
2. **Lancamentos**
3. **Gestao**
4. **Relatorios**

Configuracoes fica separada no rodape do menu lateral, acessada por icone de engrenagem, apenas para usuarios autorizados.

## Estrutura do menu

### Visualizacoes

Agrupa telas de consulta, acompanhamento e analise:

- Visao Geral.
- Dashboard Executivo.
- Mapa Estrategico.
- Mapa de Relacoes.
- Arvore Organizacional.
- Indicadores.
- Planos de Acao.
- Cronogramas.
- Reunioes.
- Acompanhamentos.

### Lancamentos

Agrupa telas de entrada operacional:

- Central de Lancamentos.
- Lancar Resultado.
- Criar Indicador.
- Criar Analise de Causa.
- Criar Reuniao.
- Criar Plano de Acao.
- Registrar Evidencia.

### Gestao

Agrupa cadastros e objetos de gestao do dia a dia:

- Estrutura Organizacional.
- Objetivos Estrategicos.
- Indicadores.
- OKRs.
- Projetos e Cronogramas.
- Governanca de Reunioes.
- Responsaveis.

### Relatorios

Agrupa consultas analiticas, auditoria e exportacoes:

- Indicadores.
- Planos de Acao.
- Reunioes.
- Auditoria.
- Exportacoes.

## Configuracoes separadas

Configuracoes nao faz parte dos grupos operacionais. Ela aparece no rodape do menu lateral com icone de engrenagem.

A tela `/settings` funciona como uma central administrativa com cards para:

- Usuarios.
- Permissoes.
- Perfis de acesso.
- Auditoria.
- Parametros.
- Empresas.
- Filiais.
- Areas e Setores.
- Notificacoes.
- Sistema.

Essa separacao evita misturar rotinas administrativas sensiveis com operacao diaria.

## Permissoes

O menu e dinamico e usa as permissoes retornadas por `GET /auth/me`.

As permissoes podem vir de:

- Permissoes diretas do usuario (`UserPermission`).
- Permissoes do perfil de acesso (`AccessProfile` + `ProfilePermission`).
- Papel `SUPER_ADMIN`, que possui acesso total.

Regras importantes:

- Usuario sem permissao nao ve o item no menu.
- Usuario sem permissao de Configuracoes nao ve a engrenagem.
- Visualizador enxerga apenas areas de leitura autorizadas.
- Super Admin ve todos os grupos e todas as opcoes.
- A exibicao no menu complementa as protecoes do backend por `@RequirePermissions(...)`.

## Responsividade

No desktop, o menu lateral usa accordion com grupos expansivos e item ativo destacado.

No mobile, o menu abre como drawer lateral a partir do botao de menu da topbar. O mesmo componente accordion e reutilizado, preservando permissao, grupo aberto e destaque da rota atual.

Existe tambem uma barra inferior compacta para rotas principais em telas pequenas, filtrada pelas mesmas permissoes.

## Implementacao

Arquivos principais:

- `apps/web/components/shell/navigation.ts`: configuracao central dos grupos, itens, rotas, icones e permissoes.
- `apps/web/components/shell/accordion-navigation.tsx`: componente reutilizavel de accordion.
- `apps/web/components/shell/sidebar.tsx`: menu lateral desktop com modo recolhido.
- `apps/web/components/shell/topbar.tsx`: drawer mobile com o mesmo accordion.
- `apps/web/components/shell/mobile-nav.tsx`: navegacao inferior mobile filtrada por permissao.
- `apps/web/app/(app)/settings/page.tsx`: central administrativa separada.
- `apps/api/src/modules/auth/auth.service.ts`: perfil autenticado com permissoes consolidadas.

## Validacao recomendada

1. Entrar como Super Admin e confirmar todos os grupos visiveis.
2. Entrar como usuario comum e confirmar que Configuracoes e itens restritos nao aparecem.
3. Abrir e fechar os accordions.
4. Navegar entre rotas e conferir o item ativo.
5. Testar o modo recolhido no desktop.
6. Testar drawer e barra inferior em mobile.
7. Confirmar que `/settings` continua protegida por permissao.
8. Confirmar que as rotas antigas continuam funcionando.

## Deploy

O build de producao deve ser executado apenas no Droplet DigitalOcean, seguindo o fluxo de deploy do projeto.
