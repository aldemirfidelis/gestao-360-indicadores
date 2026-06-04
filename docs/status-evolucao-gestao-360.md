# Status da evolução do Gestão 360

## Entregue

- Identidade visual Gestão 360 aplicada no login, menu lateral, cabeçalho, favicon, manifesto e ícones.
- Navegação separada em Visualizações, Comunicação, Lançamentos, Gestão, Relatórios e Administração.
- Cadastro e edição de usuários em `Configurações > Usuários`, incluindo dados de perfil, cargo, área e permissões por módulo.
- Estrutura organizacional em `Visualizações > Árvore Organizacional`.
- Mapa estratégico e OKRs com páginas próprias para estratégia, ciclos e resultados-chave.
- Fluxo de indicador fora da meta com desvio, análise de causa, reunião, participantes, plano de ação, convites, ICS, alertas, eficácia e rastreabilidade.
- Mapa de relações integrado com indicadores, desvios, tratativas, reuniões, planos de ação e novos objetos corporativos.
- Módulos corporativos da FASE 6: Riscos, Não Conformidades, Documentos, Auditorias, Processos/SIPOC e Formulários/Checklists.
- Auditorias conectam constatações a Não Conformidades; Processos/SIPOC conectam área, processo, indicador e etapas; Formulários/Checklists conectam templates, campos, preenchimentos e respostas.
- Documentação do fluxo de tratativa em `docs/fluxo-tratativa-indicador-fora-meta.md`.
- Documentação da FASE 6 em `docs/FASE6_MODULOS_CORPORATIVOS.md`.
- Documentação de rotas/APIs em `docs/ROTAS_E_APIS.md`.
- Guia de testes em `docs/GUIA_DE_TESTES.md`.
- Checklist de produção em `docs/CHECKLIST_PRODUCAO.md`.

## Em evolução

- Integração direta com Google Calendar ou Microsoft Outlook. Hoje o sistema gera convite ICS e registra o envio.
- Relatórios avançados em Excel/PDF com modelos executivos personalizados.
- Editor visual avançado do mapa estratégico com experiência de canvas livre.
- Testes automatizados de ponta a ponta cobrindo os fluxos operacionais críticos.
- Aplicar no Neon as migrations pendentes de Auditorias, Processos/SIPOC e Formulários/Checklists após autorização.
- Refinamento contínuo de textos antigos que ainda estejam sem acentuação em telas legadas.

## Validação atual

- Frontend: `pnpm --filter @g360/web exec tsc --noEmit` concluído com sucesso.
- API: `pnpm --filter @g360/api exec tsc --noEmit --pretty false` concluído com sucesso.
- Testes API: `pnpm --filter @g360/api test` concluído com sucesso, com 26 arquivos e 184 testes.
- Migrations aplicadas no Neon: `20260604130000_risk_register`, `20260604140000_non_conformity`, `20260604150000_document_register`.
- Migrations pendentes no Neon: `20260604160000_audit_compliance`, `20260604170000_process_sipoc`, `20260604180000_forms_checklists`.
