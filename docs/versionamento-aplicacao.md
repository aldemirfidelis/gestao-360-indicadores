# Versionamento exibido na aplicação

A versão mostrada no rodapé do login usa este formato:

```text
<versão SemVer do apps/web/package.json>+<commit Git com 8 caracteres>
```

Exemplo: `0.1.0+a1b2c3d4`.

## Como funciona

- Em desenvolvimento, `apps/web/next.config.mjs` lê a versão do pacote e o commit
  atual automaticamente.
- No deploy, `scripts/deploy.sh` calcula `APP_VERSION` depois do `git pull`.
- O Docker Compose repassa esse valor como `NEXT_PUBLIC_APP_VERSION` ao build web.
- O Next.js grava a versão no bundle e a tela de login apenas a exibe.

Assim, não há número manual esquecido em componentes. Toda alteração publicada em
um novo commit recebe uma identificação diferente e rastreável. Quando houver uma
mudança de versão do produto (por exemplo, `0.2.0`), basta atualizar a propriedade
`version` de `apps/web/package.json`; o identificador do commit continua automático.
