# Suprimentos — Arquitetura e Entrega das Fases 1–2

## Resultado desta entrega

Esta implementação entrega a primeira fatia vertical operacional do módulo de
Suprimentos, cobrindo **Estoque básico** e **Requisição → Pedido**. O objetivo é
permitir uso real antes de adicionar cotação, nota fiscal e medição de serviço.

Fluxo entregue:

```text
Solicitante cria e envia requisição com almoxarifado de destino
  → comprador assume atomicamente a fila
  → gera pedido para fornecedor
  → pedido percorre alçadas por valor
  → comprador envia ao fornecedor
  → almoxarife recebe parcial ou totalmente
  → recebimento atualiza saldo, custo médio e kardex na mesma transação

Usuário solicita retirada
  → almoxarifado aprova/separa
  → atendimento parcial ou total gera baixa no kardex
```

## Limites de domínio

- `inventory`: almoxarifados, catálogo, saldos, kardex, ajustes, transferências,
  retiradas e importação XLSX.
- `procurement`: fornecedores, requisições, fila do comprador, pedidos, alçadas
  e recebimentos físicos.
- Ambos formam o módulo de negócio `suprimentos`, incluído no plano Enterprise.
- As rotas web ficam em `/suprimentos`; APIs em `/api/inventory` e
  `/api/procurement`.

## Invariantes implementadas

1. Todo acesso é filtrado por `companyId`; referências a item, fornecedor,
   almoxarifado, usuário e área são revalidadas no tenant.
2. `StockMovement` é append-only e é gravado na mesma transação de
   `StockBalance`; o AuditWriter é uma trilha complementar, não a razão contábil.
3. Quantidades e custos usam `Decimal`, nunca `float`.
4. Movimentações usam transação `SERIALIZABLE`, bloqueio de linha
   `SELECT ... FOR UPDATE`, ordem estável de processamento e retry de conflito.
5. Saldo negativo é bloqueado, salvo quando o almoxarifado foi explicitamente
   configurado para permiti-lo.
6. Recebimento, retirada, ajuste e transferência exigem chave de idempotência.
7. O recebimento físico (`PurchaseReceipt`) é a única origem de entrada de
   pedido. Na Fase 3, a NF será vinculada/criará um recebimento sem gerar uma
   segunda entrada.
8. Serviços não movimentam estoque. O pedido de serviço permanece bloqueado
   até a Fase 4, quando haverá medição aprovada antes do faturamento.
9. A fila do comprador usa `updateMany` condicional para impedir que dois
   compradores assumam a mesma requisição.
10. As alçadas aplicáveis são copiadas para `PurchaseOrderApproval`, incluindo
    faixa, nível, valor do pedido, usuário/papel e decisão. Mudanças futuras na
    regra não reescrevem o histórico do pedido.

## Migrações

- `20260710140000_supply_inventory_core`: Fase 1.
- `20260710150000_supply_procurement_core`: Fase 2.

As migrações são aditivas, não executam seed e não foram aplicadas em produção.
Produção continua dependendo de autorização explícita.

## RBAC

Compras:

- `compras:view`, `compras:request`, `compras:buy`, `compras:approve`,
  `compras:manage`.

Estoque:

- `estoque:view`, `estoque:withdraw`, `estoque:operate`, `estoque:approve`,
  `estoque:transfer`, `estoque:adjust`, `estoque:manage`.

## Integrações da plataforma

- Meu Dia coleta fila do comprador, alçadas e fila do almoxarifado.
- AuditWriter registra eventos semânticos; o interceptor global mantém a trilha
  HTTP adicional.
- MaintenanceScheduler reutiliza `NotificationsService.generateAlerts` para
  estoque mínimo e pedido com entrega vencida.
- Organograma fornece área/centro de custo.
- PortalGateGuard aplica os gates `procurement` e `inventory`.
- O importador XLSX processa catálogo e, opcionalmente, saldo inicial com kardex.

## Próximas fases sem atalhos

### Fase 3 — Cotações e NF material

- `Quotation`/itens e mapa comparativo com justificativa de vencedor.
- `SupplierInvoice`/itens, chave de acesso única, XML/PDF no GED.
- NF material deve vincular um `PurchaseReceipt`; nunca duplicar o movimento já
  criado pelo recebimento físico.

### Fase 4 — Serviços

- `ServiceMeasurement`/itens e fiscal responsável.
- Estado `APPROVED` obrigatório antes de aceitar NF de serviço.
- Serviço não cria `StockBalance` nem `StockMovement`.

### Fase 5 — Almoxarifado avançado

- Inventário cíclico, curva ABC, QR de item/prateleira e políticas de aprovação
  de retirada por área/valor.

## Verificação

- Testes puros: `supplies.logic.spec.ts`.
- Regressão de isolamento: `supplies-tenant-isolation.spec.ts`.
- E2E API/UI: `tests/e2e/supplies.spec.ts`.
- Comandos esperados: Prisma validate/generate, build da API, lint/build web e
  testes direcionados. Limitações do Windows relativas ao DLL/symlink continuam
  valendo conforme a memória operacional.
