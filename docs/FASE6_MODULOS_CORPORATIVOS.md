# FASE 6 - Modulos corporativos

Esta fase completa a camada corporativa de gestao integrada sobre o fluxo principal de indicadores, desvios, acoes e eficacia.

## Modulos Entregues

| Modulo | Rota | Permissoes | Migration |
| --- | --- | --- | --- |
| Riscos | `/risks` | `risks:*` | `20260604130000_risk_register` |
| Nao Conformidades | `/nonconformities` | `nc:*` | `20260604140000_non_conformity` |
| Documentos | `/documents` | `doc:*` | `20260604150000_document_register` + `20260605100000_document_ged_foundation` |
| Auditorias | `/audits` | `audits:*` | `20260604160000_audit_compliance` + `20260605113000_audit_compliance_foundation` |
| Processos/SIPOC | `/processes` | `processes:*` | `20260604170000_process_sipoc` |
| Formularios/Checklists | `/forms` | `forms:*` | `20260604180000_forms_checklists` + `20260605143000_forms_operational_platform` |

## Integracoes Principais

- Riscos vinculam area, indicador, projeto e acao de mitigacao.
- Nao Conformidades implementam CAPA: contencao, causa raiz, acao corretiva e eficacia.
- Documentos implementam ciclo de vida: rascunho, revisao, aprovacao, publicacao e obsolescencia.
- Auditorias gerenciam programa, universo auditavel por risco, auditores, checklists, evidencias, constatacoes, NCs, follow-up, relatorios e timeline.
- Processos/SIPOC registram fornecedores, entradas, saidas, clientes e etapas do fluxo.
- Formularios/Checklists gerenciam templates, versoes publicadas, execucoes, preenchimentos, evidencias, aprovacoes, pendencias e registros operacionais.
- Eventos vinculados a indicador abrem deep-links nas rotas de origem: `/risks`, `/nonconformities`, `/documents`, `/processes` e `/forms`.

## Seguranca e Isolamento

- Todos os modulos novos filtram por `companyId`.
- Quando ha vinculo com area, indicador ou processo, o `AccessService` aplica escopo de area.
- Validacoes cross-company impedem vincular objetos de outra empresa.
- Catalogos de permissao e portal foram atualizados para os perfis padrao.

## Status Das Migrations

Aplicadas no Neon:

- `20260604130000_risk_register`
- `20260604140000_non_conformity`
- `20260604150000_document_register`
- `20260604160000_audit_compliance`
- `20260604170000_process_sipoc`
- `20260604180000_forms_checklists`
- `20260605100000_document_ged_foundation`
- `20260605113000_audit_compliance_foundation`
- `20260605143000_forms_operational_platform`

## Validacao

- `pnpm --filter @g360/api exec prisma validate`
- `pnpm --filter @g360/api exec tsc --noEmit --pretty false`
- `pnpm --filter @g360/web exec tsc --noEmit --pretty false`
- `pnpm --filter @g360/api test`

Resultados especificos:

- Auditorias: `audits.service.spec.ts`, 9 testes passando.
- Formularios: `forms.service.spec.ts`, 10 testes passando.

## Atualizacao GED Documentos

O modulo Documentos foi ampliado pela migration `20260605100000_document_ged_foundation`.
A documentacao tecnica completa esta em `docs/GED_DOCUMENTOS.md`.

## Atualizacao Auditorias e Compliance

O modulo Auditorias foi ampliado pela migration `20260605113000_audit_compliance_foundation`.
A documentacao tecnica completa esta em `docs/AUDITORIAS_COMPLIANCE.md`.

## Atualizacao Formularios e Checklists

O modulo Formularios foi ampliado pela migration `20260605143000_forms_operational_platform`.
A documentacao tecnica completa esta em `docs/FORMULARIOS_CHECKLISTS.md`.
