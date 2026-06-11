# =====================================================
# Makefile para uso na Droplet
# =====================================================

COMPOSE := docker compose -f docker-compose.droplet.yml

.PHONY: help deploy build up down restart logs logs-api logs-web logs-caddy ps migrate seed reset-seed shell-api shell-web

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

deploy: ## Pull + build + up + migrate (deploy completo)
	bash scripts/deploy.sh

build: ## Build das imagens Docker (sequencial para Droplets pequenas)
	$(COMPOSE) build --pull api
	$(COMPOSE) build --pull web

up: ## Sobe containers
	$(COMPOSE) up -d --remove-orphans

down: ## Para containers
	$(COMPOSE) down

restart: ## Reinicia todos os containers
	$(COMPOSE) restart

restart-api: ## Reinicia so a API
	$(COMPOSE) restart api

restart-web: ## Reinicia so o Web
	$(COMPOSE) restart web

restart-caddy: ## Reinicia so o Caddy (recarrega Caddyfile)
	$(COMPOSE) restart caddy

logs: ## Tail de todos os logs
	$(COMPOSE) logs -f --tail=100

logs-api: ## Tail logs da API
	$(COMPOSE) logs -f --tail=100 api

logs-web: ## Tail logs do Web
	$(COMPOSE) logs -f --tail=100 web

logs-caddy: ## Tail logs do Caddy
	$(COMPOSE) logs -f --tail=100 caddy

ps: ## Status dos containers
	$(COMPOSE) ps

migrate: ## Roda prisma migrate deploy manualmente
	$(COMPOSE) exec api ./node_modules/.bin/prisma migrate deploy

seed: ## Roda seed (CUIDADO: limpa e recria dados demo!)
	$(COMPOSE) exec api npx tsx prisma/seed.ts

seed-prize-estradas: ## Popula o exemplo do anexo 0561 (Prêmio Estradas) na empresa real
	$(COMPOSE) exec -T api npx tsx prisma/seed-prize-estradas.ts

shell-api: ## Shell dentro do container API
	$(COMPOSE) exec api sh

shell-web: ## Shell dentro do container Web
	$(COMPOSE) exec web sh

clean: ## Remove imagens nao utilizadas
	docker image prune -af
	docker volume prune -f

stats: ## Mostra uso de CPU/RAM dos containers
	docker stats --no-stream
