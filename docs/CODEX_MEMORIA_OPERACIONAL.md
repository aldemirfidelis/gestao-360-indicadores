# Memoria Operacional do Projeto

Este arquivo deve ser analisado antes de qualquer tarefa no repositorio
`gestao-360-indicadores`.

## Estado Geral

- Repositorio local: `c:\Projetos\gestao-360-indicadores`
- Branch principal usada para deploy: `main`
- Remote GitHub: `https://github.com/aldemirfidelis/gestao-360-indicadores.git`
- Dominio de producao: `https://gestao360.org`
- Droplet atual do dominio: `159.89.91.222`
- Diretorio esperado no droplet: `/opt/gestao-360-indicadores`

## Build e Validacao

Comandos usados antes de publicar alteracoes:

```bash
pnpm --filter @g360/api build
pnpm --filter @g360/web lint
pnpm --filter @g360/web build
```

Observacao importante no Windows:

- O build web pode compilar, validar tipos e gerar as paginas com sucesso, mas falhar
  no final ao copiar arquivos `standalone` por erro `EPERM` de `symlink`.
- Esse erro e uma limitacao local do Windows/permissoes de symlink. O build real em
  producao roda no Docker/Linux do droplet.

## Commit e Push

Ultimo commit confirmado e enviado para `origin/main`:

```text
caa6788 feat: ajustar portal admin e seguranca patrimonial
```

Antes de commitar:

```bash
git status -sb
git diff --check
git diff --stat
```

Depois do commit:

```bash
git push origin main
git ls-remote origin main
```

## Deploy no Droplet

O deploy padrao no droplet e:

```bash
cd /opt/gestao-360-indicadores
bash scripts/deploy.sh
```

O script `scripts/deploy.sh` executa, em resumo:

- `git pull --ff-only`
- build das imagens Docker da API e do Web
- `docker compose -f docker-compose.droplet.yml up -d`
- `prisma migrate deploy` dentro do container da API

Antes de rodar deploy no droplet, conferir:

```bash
cd /opt/gestao-360-indicadores
git status -sb
grep -E '^(DATABASE_URL|DIRECT_URL)=' .env | grep '@postgres:5432'
```

Se o Git estiver limpo e as URLs apontarem para `postgres:5432`, o deploy deve subir
as mudancas publicadas em `origin/main`.

## Banco de Dados

O Postgres de producao agora e local no droplet.

- Compose: `docker-compose.droplet.yml`
- Servico: `postgres`
- Volume persistente: `g360_pgdata`
- Host interno esperado nas URLs: `postgres`
- Porta interna: `5432`

O `.env.droplet.example` documenta o modelo correto:

```text
DATABASE_URL=postgresql://...@postgres:5432/g360?schema=public&connection_limit=20
DIRECT_URL=postgresql://...@postgres:5432/g360?schema=public
```

Nao voltar a producao para Neon/pooler sem pedido explicito do usuario.

## SSH do Droplet

Configuracao local encontrada anteriormente:

- Host configurado no SSH: `g360 droplet`
- HostName: `159.89.91.222`
- User: `root`
- IdentityFile: `~/.ssh/beeeyes_digitalocean`

O script `scripts/release.ps1` usa:

```text
root@159.89.91.222
~/.ssh/beeeyes_digitalocean
```

Em 2026-06-17, o site respondeu em HTTPS, mas SSH na porta 22 para
`159.89.91.222` deu timeout a partir da maquina local. Se isso ocorrer novamente,
validar VPN/firewall/acesso SSH antes de considerar erro do deploy.

## Alteracoes Funcionais Recentes

### Usuarios e Permissoes

- Adicionado checkbox "Selecionar todos" ao lado de Permissoes na tela de usuario,
  permitindo marcar todas as permissoes e desmarcar apenas as indesejadas.

### Portal Administrativo Global

- O Portal Administrativo Global deve ter acesso total aos usuarios das empresas,
  nao apenas bloquear/revogar.
- Foram adicionadas rotas bridge em `/platform-admin/users` para listar, criar,
  editar, ativar/desativar, excluir e gerenciar permissoes no contexto da empresa.
- O app do Portal Admin passou a incluir a tela completa de usuarios no contexto
  da empresa selecionada.
- A tela de Areas e Setores no Portal Admin foi ajustada para carregar dentro dos
  providers necessarios e evitar erro client-side.

### Seguranca Patrimonial

- Titulo alterado para "Seguranca Patrimonial".
- Removidos botoes superiores: "Registrar entrada", "Registrar saida" e
  "Emergencia".
- Removida a funcao/codigo de emergencia por enquanto.
- Na aba Operacao, criado modo de tela cheia/foco para uso da portaria.
- Em Registrar saida, o ID de entrada em aberto virou combobox com IDs abertos.
- Ao selecionar a entrada em aberto, pessoa, veiculo, placa e portaria sao
  preenchidos automaticamente; o porteiro informa apenas observacoes.
- Em Registrar entrada, Pessoa passou a ser obrigatorio e digitavel por cadastro,
  CPF ou nome, sem combobox.
- Criada importacao de pessoas no padrao da planilha:
  `Cadastro`, `Nome Colaborador`, `CPF`, `Local`, `Cargo`, `Area de Atuacao`.

## Cuidados

- Nao commitar arquivos `.env` reais.
- Nao sobrescrever alteracoes locais de terceiros.
- Preferir comandos nao destrutivos.
- Para deploy, garantir que o servidor esta em `main`, limpo e apontando para
  Postgres local antes de rodar o script.
