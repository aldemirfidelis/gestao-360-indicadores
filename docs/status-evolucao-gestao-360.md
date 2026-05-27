# Status da evolução do Gestão 360

## Entregue

- Identidade visual Gestão 360 aplicada no login, menu lateral, cabeçalho, favicon, manifesto e ícones.
- Navegação separada em Início, Lançamentos, Visualização e Configurações.
- Cadastro e edição de usuários em `Configurações > Usuários`, incluindo dados de perfil, cargo, área e permissões por módulo.
- Estrutura organizacional em `Visualização > Árvore de gestão`.
- Mapa estratégico e OKRs com páginas próprias para estratégia, ciclos e resultados-chave.
- Fluxo de indicador fora da meta com tratativa, análise de causa, reunião, participantes, plano de ação, convites, ICS, alertas e rastreabilidade.
- Banco de dados atualizado com casos de tratativa, logs de e-mail, convites de calendário, participantes e eventos de rastreabilidade.
- Mapa de relações integrado com indicadores, desvios, tratativas, reuniões e planos de ação.
- Documentação do fluxo de tratativa em `docs/fluxo-tratativa-indicador-fora-meta.md`.

## Em evolução

- Integração direta com Google Calendar ou Microsoft Outlook. Hoje o sistema gera convite ICS e registra o envio.
- Relatórios avançados em Excel/PDF com modelos executivos personalizados.
- Editor visual avançado do mapa estratégico com experiência de canvas livre.
- Testes automatizados de ponta a ponta cobrindo todos os fluxos operacionais.
- Refinamento contínuo de textos antigos que ainda estejam sem acentuação em telas legadas.

## Validação atual

- O typecheck do frontend foi executado com sucesso usando `pnpm --filter @g360/web exec tsc --noEmit`.
- Não houve nova alteração de banco nesta etapa de identidade visual; as migrações da tratativa de indicador fora da meta já estão versionadas.
