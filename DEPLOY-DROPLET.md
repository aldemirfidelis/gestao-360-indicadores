# Deploy em Droplet DigitalOcean + Neon Postgres

Guia para subir a aplicacao em uma **Droplet** (VM Linux gerenciada por voce) com **banco no Neon** e **Caddy** como proxy reverso com SSL automatico.

## Por que Droplet em vez do App Platform?

| Quesito | Droplet | App Platform |
|---|---|---|
| Custo | $6/mes | ~$10/mes (2 servicos) |
| Controle | Total (SSH) | Limitado |
| Deploy | `git pull` + `make deploy` | `git push` automatico |
| SSL | Caddy auto | Auto |
| Escalabilidade | Manual | 1 click |
| Manutencao | Voce | DigitalOcean |

Escolhi Droplet porque **voce ja usa** (BeeYes) e quer controle.

---

## Sumario

1. [Pre-requisitos](#1-pre-requisitos)
2. [Criar Droplet](#2-criar-droplet)
3. [Setup inicial (script automatico)](#3-setup-inicial)
4. [Configurar `.env` com Neon + JWT](#4-configurar-env)
5. [Primeiro deploy](#5-primeiro-deploy)
6. [Acessar e testar](#6-acessar-e-testar)
7. [Comandos do dia a dia (Makefile)](#7-comandos-do-dia-a-dia)
8. [Adicionar dominio + SSL](#8-adicionar-dominio--ssl)
9. [Atualizacoes futuras](#9-atualizacoes-futuras)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Pre-requisitos

- Conta na **DigitalOcean** com forma de pagamento
- **SSH key cadastrada** no DigitalOcean (em Account → Security → SSH keys)
- Banco **Neon** ja provisionado (URLs pooled e direct em maos)
- Repo `aldemirfidelis/gestao-360-indicadores` ja no GitHub

---

## 2. Criar Droplet

1. Acesse <https://cloud.digitalocean.com/droplets>
2. Clique em **Create Droplet**
3. Configure:
   - **Region**: NYC3 ou SFO3 (latencia ~150ms ate Neon SA-East, OK)
   - **OS**: Ubuntu 24.04 LTS x64
   - **Plan**: Basic → **Regular SSD → $6/mes** (1 GB RAM, 1 vCPU, 25 GB SSD, 1 TB transfer)
   - **Authentication**: SSH Key → selecione a chave que voce ja tem
   - **Hostname**: `gestao-360-prod`
   - **Project**: (opcional) o mesmo do BeeYes ou novo
4. **Create Droplet**

Aguarde ~30s. Anote o **IPv4 publico** que aparece no painel (ex.: `159.203.45.67`).

---

## 3. Setup inicial

Conecte via SSH (substitua `SEU_IP`):

```bash
ssh root@SEU_IP
```

Na primeira conexao, aceita o fingerprint digitando `yes`.

Rode o script de setup direto do GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/aldemirfidelis/gestao-360-indicadores/main/scripts/setup-droplet.sh | bash
```

O script faz tudo automaticamente:
- Atualiza Ubuntu
- Instala Docker + Compose plugin
- Instala git, make, ufw
- Configura firewall (libera 22, 80, 443)
- Clona o repo em `/opt/gestao-360-indicadores`
- Cria `.env` a partir do template

Demora ~3 min.

---

## 4. Configurar .env

```bash
cd /opt/gestao-360-indicadores
nano .env
```

Edite os valores marcados com `TROCAR_*`. As URLs do Neon ja estao no template (mesmas que voce usa local), mas troque os JWT secrets:

```bash
# Gere 2 secrets fortes (rode 2x e copie cada um):
openssl rand -base64 48
openssl rand -base64 48
```

Cole no `.env`:

```
JWT_ACCESS_SECRET=<primeiro_secret_gerado>
JWT_REFRESH_SECRET=<segundo_secret_gerado>
```

Salve com `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## 5. Primeiro deploy

```bash
cd /opt/gestao-360-indicadores
bash scripts/deploy.sh
```

Este comando:
1. Faz `git pull` (caso tenha atualizacao)
2. Builda as 2 imagens Docker (API + Web). **Primeira build demora 5-10 min**.
3. Sobe os 3 containers (api, web, caddy)
4. Roda `prisma migrate deploy` automaticamente (no CMD da API)
5. Mostra status

Acompanhe os logs:

```bash
docker compose -f docker-compose.droplet.yml logs -f
```

Quando ver `[g360-api] listening on http://0.0.0.0:3333/api` e `Ready in Xs` do Next, esta funcionando.

---

## 6. Acessar e testar

Abra no browser:

```
http://SEU_IP
```

Login demo:
- E-mail: `admin@demo.com`
- Senha: `admin123`

> **Aviso**: sem dominio nao tem HTTPS. Os browsers mostram "Nao seguro". OK para testes.

API health:

```
http://SEU_IP/api/health
```

---

## 7. Comandos do dia a dia

Na pasta `/opt/gestao-360-indicadores`, voce tem um **Makefile**:

```bash
make help            # Lista todos os comandos
make deploy          # Atualizacao completa (pull + build + restart)
make logs            # Tail de todos os logs
make logs-api        # So da API
make logs-web        # So do Web
make logs-caddy      # So do Caddy
make restart         # Restart de tudo
make restart-api     # So a API
make restart-caddy   # Recarrega Caddyfile
make ps              # Status containers
make stats           # CPU/RAM em tempo real
make migrate         # Roda migrate deploy manualmente
make seed            # Roda seed (CUIDADO: reseta dados!)
make shell-api       # sh dentro do container API
make clean           # Remove imagens antigas
make down            # Para tudo
make up              # Sobe tudo
```

---

## 8. Adicionar dominio + SSL

Quando tiver um dominio (ex.: `gestao.suaempresa.com.br`):

1. No seu provedor DNS (Registro.br, Cloudflare, etc.), crie um **A record** apontando para o IP da Droplet.

2. Aguarde propagacao (5-30 min). Confirme com:
   ```bash
   dig gestao.suaempresa.com.br
   ```

3. Edite o Caddyfile:
   ```bash
   nano /opt/gestao-360-indicadores/Caddyfile
   ```

4. Substitua `:80 {` pela linha com seu dominio:
   ```
   gestao.suaempresa.com.br {
       tls aldemir.fidelis@gmail.com
       ...
   }
   ```

5. Recarregue o Caddy:
   ```bash
   make restart-caddy
   ```

Caddy emite o certificado Let's Encrypt automaticamente em ~30s. Acesse `https://gestao.suaempresa.com.br`.

6. Atualize tambem o `.env` com o dominio correto em `API_CORS_ORIGIN`:
   ```
   API_CORS_ORIGIN=https://gestao.suaempresa.com.br
   ```
   E reinicie a API:
   ```bash
   make restart-api
   ```

---

## 9. Atualizacoes futuras

Workflow normal:

```bash
# Local (na sua maquina)
git add .
git commit -m "feat: nova funcionalidade"
git push

# Na Droplet (via SSH)
ssh root@SEU_IP
cd /opt/gestao-360-indicadores
make deploy
```

`make deploy` faz `git pull` + rebuild + restart. Downtime ~5-10s.

---

## 10. Troubleshooting

### Build falha por falta de memoria
Droplet $6/mes tem 1GB RAM. Build do Next pode estourar. Solucoes:
- Adicionar swap:
  ```bash
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ```
- Ou escalar para $12/mes (2GB RAM)

### `Permission denied` ao rodar scripts
```bash
chmod +x scripts/*.sh
```

### Caddy nao consegue emitir SSL
- Verifique que dominio aponta de verdade para a Droplet: `dig +short SEU_DOMINIO`
- Confirme que porta 443 esta aberta: `ufw status`
- Veja logs: `make logs-caddy`

### API nao conecta no Neon
- Confirme que `DATABASE_URL` no `.env` esta correta (com `?sslmode=require&pgbouncer=true`)
- Teste manualmente:
  ```bash
  docker run --rm -it postgres:16-alpine psql "$DATABASE_URL"
  ```

### Migration travou
Se o boot da API trava em "Applying migration":
```bash
make shell-api
node ../../node_modules/prisma/build/index.js migrate status
```
Resolva conforme o estado mostrado.

### Quero pular migrate em um deploy
Adicione no `.env`:
```
SKIP_MIGRATE=1
```
E reinicie:
```bash
make restart-api
```

### Reseed (sobrescrever dados demo)
```bash
make seed
```
**CUIDADO**: limpa e recria todos os dados. Use so se for ambiente de teste.

---

## Apendice — checklist final

- [ ] Droplet criada com SSH key
- [ ] `setup-droplet.sh` rodou sem erros
- [ ] `.env` editado com `JWT_*_SECRET` gerados (NAO usar os do template)
- [ ] `make deploy` completou sem erros
- [ ] `http://SEU_IP` carrega login
- [ ] Login funciona (`admin@demo.com` / `admin123`)
- [ ] Dashboard mostra dados (15 indicadores, KPIs etc.)
- [ ] Senha do admin trocada apos primeiro acesso
- [ ] `make logs` nao mostra erros recorrentes
- [ ] (Opcional) Dominio configurado + SSL ativo
- [ ] Backup do Neon ativo (PITR padrao 7 dias no free tier)
