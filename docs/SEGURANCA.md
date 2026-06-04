# Segurança

Consolidação prática dos controles atuais de segurança, isolamento multiempresa e permissões por área.

## Modelo de acesso

- Autenticação por JWT com guards globais na API.
- `companyId` vem da sessão autenticada ou da empresa ativa do usuário. O frontend não é fonte confiável para trocar tenant.
- `SUPER_ADMIN` pode operar com empresa ativa/impersonação controlada; `COMPANY_ADMIN` opera dentro da própria empresa.
- Permissões continuam baseadas em chaves `module:action`, como `indicators:view`, `actions:edit` ou `audits:create`.
- O escopo por área é resolvido pelo `AccessService` a partir de `OrgNode`, atribuições do usuário, matriz de visibilidade e exceções.

## Isolamento multiempresa

Regras esperadas:

- Queries operacionais escopam por `companyId`.
- Mutations validam vínculos antes de gravar para impedir objetos de outra empresa.
- Filhos são buscados pelo agregado pai quando o filho não tem `companyId` próprio.
- Tentativas negadas devem falhar como `Forbidden` ou `NotFound`, evitando vazamento de existência de dados externos.

## Escopo por área

O `AccessService` aplica:

- leitura por `listAreaFilter`;
- escrita por `assertCanWrite`;
- nível resumido por `visibilityLevel` quando a regra permite apenas visão parcial;
- auditoria de negações em `AuditLog`.

Módulos com enforcement e testes unitários específicos:

- indicadores e planos de ação;
- desvios, reuniões, projetos, relatórios e busca;
- riscos, não conformidades, documentos, auditorias, processos/SIPOC e formulários/checklists.

Módulos company-wide por desenho:

- estratégia/mapa executivo;
- OKRs sem área direta;
- administração de portal e banco, protegidas por perfil/guard;
- estrutura organizacional, com writes administrativos.

## Módulos sensíveis

| Área | Controle |
| --- | --- |
| Database Admin | Rota `/settings/database`, permissão administrativa e auditoria própria |
| Portal Admin | Rota `/settings/portal`, permissão administrativa e auditoria própria |
| Integrações | Credenciais via variáveis/serviços; não expor chaves no frontend |
| IA | Contextos operacionais filtrados por escopo antes de enviar ao provedor |
| Documentos e evidências | URLs/conteúdo externo devem ser tratados como dados sensíveis |

## Checklist de produção

- Rotacionar `JWT_SECRET` e `JWT_REFRESH_SECRET` antes de produção definitiva.
- Conferir CORS no ambiente de deploy.
- Confirmar `helmet` ativo na API.
- Não registrar `.env`, tokens, senhas ou URLs com credenciais em logs.
- Validar perfis padrão em `permission-catalog.ts`.
- Conferir `prisma migrate status` antes e depois do deploy.
- Aplicar migrations pendentes apenas com autorização explícita.
- Revisar usuários `SUPER_ADMIN` e senhas fortes.

## Validação

Último gate registrado na FASE 7:

- API typecheck verde.
- Web typecheck verde.
- API tests: 184 testes passando.
- E2E smoke: 4 testes passando.
- Prisma schema válido.

Pendência assumida:

- E2E operacional completo em banco isolado após aplicar as migrations pendentes em um ambiente de teste.
