# FASE 6 - Módulos corporativos

Esta fase completa a camada corporativa de gestão integrada sobre o fluxo principal de indicadores, desvios, ações e eficácia.

## Módulos entregues

| Módulo | Rota | Permissões | Migration |
| --- | --- | --- | --- |
| Riscos | `/risks` | `risks:*` | `20260604130000_risk_register` |
| Não Conformidades | `/nonconformities` | `nc:*` | `20260604140000_non_conformity` |
| Documentos | `/documents` | `doc:*` | `20260604150000_document_register` |
| Auditorias | `/audits` | `audits:*` | `20260604160000_audit_compliance` |
| Processos/SIPOC | `/processes` | `processes:*` | `20260604170000_process_sipoc` |
| Formulários/Checklists | `/forms` | `forms:*` | `20260604180000_forms_checklists` |

## Integrações principais

- Riscos vinculam área, indicador, projeto e ação de mitigação.
- Não Conformidades implementam CAPA: contenção, causa raiz, ação corretiva e eficácia.
- Documentos implementam ciclo de vida: rascunho, revisão, aprovação, publicação e obsolescência.
- Auditorias registram constatações e podem gerar Não Conformidades.
- Processos/SIPOC registram fornecedores, entradas, saídas, clientes e etapas do fluxo.
- Formulários/Checklists registram templates, campos configuráveis, submissões e respostas.
- Eventos vinculados a indicador abrem deep-links nas rotas de origem: `/risks`, `/nonconformities`, `/documents`, `/processes` e `/forms`.

## Segurança e isolamento

- Todos os módulos novos filtram por `companyId`.
- Quando há vínculo com área, indicador ou processo, o `AccessService` aplica escopo de área.
- Validações cross-company impedem vincular objetos de outra empresa.
- Catálogos de permissão e portal foram atualizados para os perfis padrão.

## Status das migrations

Aplicadas no Neon:

- `20260604130000_risk_register`
- `20260604140000_non_conformity`
- `20260604150000_document_register`

Pendentes no Neon, aguardando autorização:

- `20260604160000_audit_compliance`
- `20260604170000_process_sipoc`
- `20260604180000_forms_checklists`

## Validação

- `pnpm --filter @g360/api exec tsc --noEmit --pretty false`
- `pnpm --filter @g360/web exec tsc --noEmit`
- `pnpm --filter @g360/api test`

Resultado atual da API: 26 arquivos de teste, 184 testes passando.
