# Checklist de produção

## Antes do deploy

- Confirmar branch e commits a publicar.
- Rodar `git status --short` e garantir árvore limpa.
- Rodar `pnpm --filter @g360/api exec prisma validate`.
- Rodar `pnpm --filter @g360/api exec tsc --noEmit --pretty false`.
- Rodar `pnpm --filter @g360/web exec tsc --noEmit`.
- Rodar `pnpm --filter @g360/api test`.
- Rodar `pnpm test:e2e` quando o Chromium do Playwright já estiver instalado (`pnpm e2e:install`).
- Rodar `pnpm build` quando o ambiente local tiver recursos suficientes para build completo.

## Migrations

Aplicadas no Neon:

- `20260604130000_risk_register`
- `20260604140000_non_conformity`
- `20260604150000_document_register`

Pendentes no Neon:

- `20260604160000_audit_compliance`
- `20260604170000_process_sipoc`
- `20260604180000_forms_checklists`

Aplicar apenas com autorização explícita:

```bash
pnpm --filter @g360/api exec prisma migrate deploy
```

## Variáveis de ambiente

Conferir:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `NEXT_PUBLIC_API_URL`
- credenciais SMTP, se envio de e-mail estiver ativo;
- chaves de IA/Google/Microsoft, quando integrações estiverem habilitadas.

## Segurança

- Confirmar que o usuário Super Admin está protegido por senha forte.
- Verificar perfis padrão em `permission-catalog.ts`.
- Validar bloqueios de `/settings/database` e `/settings/portal`.
- Conferir `AccessService` em módulos novos quando houver área/indicador/processo.
- Não expor `.env` em logs de CI/CD.

## Pós-deploy

- Conferir `/health`.
- Entrar com usuário administrativo.
- Verificar navegação dos módulos FASE 6.
- Validar pelo menos um deep-link da timeline do indicador.
- Conferir `prisma migrate status`.
- Monitorar logs da API durante os primeiros acessos.
