'use client';

import { useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeftRight, Boxes, Check, ClipboardList, Download, FileCheck2, PackageCheck,
  Plus, ReceiptText, Send, Settings, ShoppingCart, Store, Truck, Upload, Warehouse as WarehouseIcon, X,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { DataTable, type ColumnDef } from '@/components/platform/data-table';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  FulfillDialog, ImportDialog, OrderDialog, ReceiveDialog, RegistrationDialog, RequisitionDialog,
  StockOperationDialog, WithdrawalDialog, type RegistrationKind,
} from './supplies-dialogs';
import type {
  ApprovalRule, InventoryDashboard, MaterialWithdrawal, ProcurementDashboard, ProcurementOptions,
  PurchaseOrder, PurchaseRequisition, StockBalance, StockItem, StockMovement, Supplier, Warehouse,
} from './supplies-types';
import { SuppliesAdvanced } from './supplies-advanced';

type WriteRequest = { path: string; method?: string; json?: unknown; success: string; after?: () => void };
const TABS = ['dashboard', 'requisitions', 'orders', 'stock', 'warehouse', 'advanced', 'registrations'] as const;
type Tab = typeof TABS[number];

export function SuppliesWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const { hasPermission, user } = useAuth();
  const requestedTab = params.get('tab') as Tab | null;
  const [tab, setTabState] = useState<Tab>(requestedTab && TABS.includes(requestedTab) ? requestedTab : 'dashboard');
  const [requisitionOpen, setRequisitionOpen] = useState(false);
  const [orderFor, setOrderFor] = useState<PurchaseRequisition | null>(null);
  const [receiveFor, setReceiveFor] = useState<PurchaseOrder | null>(null);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [fulfillFor, setFulfillFor] = useState<MaterialWithdrawal | null>(null);
  const [stockOperation, setStockOperation] = useState<'adjust' | 'transfer' | null>(null);
  const [registration, setRegistration] = useState<RegistrationKind | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const canProcurement = hasPermission(['compras:view', 'compras:request', 'compras:buy', 'compras:approve', 'compras:manage']);
  const canBuy = hasPermission(['compras:buy', 'compras:manage']);
  const canApprove = hasPermission(['compras:approve', 'compras:manage']);
  const canProcurementOverview = canProcurement || canApprove;
  const canManagePurchasing = hasPermission(['compras:manage']);
  const canStock = hasPermission(['estoque:view', 'estoque:withdraw', 'estoque:operate', 'estoque:approve', 'estoque:transfer', 'estoque:adjust', 'estoque:manage']);
  const canOperateStock = hasPermission(['estoque:operate', 'estoque:manage']);
  const canApproveWithdrawal = hasPermission(['estoque:approve', 'estoque:manage']);
  const canManageStock = hasPermission(['estoque:manage']);
  const canTransferStock = hasPermission(['estoque:transfer', 'estoque:manage']);
  const canAdjustStock = hasPermission(['estoque:adjust', 'estoque:manage']);

  function setTab(value: string) {
    const next = value as Tab;
    setTabState(next);
    router.replace(`/suprimentos?tab=${next}`, { scroll: false });
  }

  const procurementDashboard = useQuery<ProcurementDashboard>({ queryKey: ['supplies', 'procurement-dashboard'], queryFn: () => api('/procurement/dashboard'), enabled: canProcurementOverview });
  const inventoryDashboard = useQuery<InventoryDashboard>({ queryKey: ['supplies', 'inventory-dashboard'], queryFn: () => api('/inventory/dashboard'), enabled: canStock });
  const options = useQuery<ProcurementOptions>({ queryKey: ['supplies', 'options'], queryFn: () => api('/procurement/options'), enabled: canProcurementOverview || canStock });
  const requisitions = useQuery<PurchaseRequisition[]>({ queryKey: ['supplies', 'requisitions'], queryFn: () => api('/procurement/requisitions?scope=all'), enabled: canProcurement });
  const orders = useQuery<PurchaseOrder[]>({ queryKey: ['supplies', 'orders'], queryFn: () => api('/procurement/orders'), enabled: canProcurementOverview || canStock });
  const balances = useQuery<StockBalance[]>({ queryKey: ['supplies', 'balances'], queryFn: () => api('/inventory/balances'), enabled: canStock });
  const movements = useQuery<StockMovement[]>({ queryKey: ['supplies', 'movements'], queryFn: () => api('/inventory/movements?take=500'), enabled: canStock });
  const withdrawals = useQuery<MaterialWithdrawal[]>({ queryKey: ['supplies', 'withdrawals'], queryFn: () => api('/inventory/withdrawals?scope=all'), enabled: canStock });
  const warehouses = useQuery<Warehouse[]>({ queryKey: ['supplies', 'warehouses'], queryFn: () => api('/inventory/warehouses?includeInactive=true'), enabled: canStock || canManagePurchasing });
  const items = useQuery<StockItem[]>({ queryKey: ['supplies', 'items'], queryFn: () => api('/inventory/items?includeInactive=true'), enabled: canStock || canProcurement });
  const suppliers = useQuery<Supplier[]>({ queryKey: ['supplies', 'suppliers'], queryFn: () => api('/procurement/suppliers?includeInactive=true'), enabled: canProcurement });
  const rules = useQuery<ApprovalRule[]>({ queryKey: ['supplies', 'rules'], queryFn: () => api('/procurement/approval-rules'), enabled: canProcurement });

  const write = useMutation({
    mutationFn: (request: WriteRequest) => api(request.path, { method: request.method ?? 'POST', json: request.json ?? {} }),
    onSuccess: (_data, request) => {
      toast.success(request.success);
      request.after?.();
      void qc.invalidateQueries({ queryKey: ['supplies'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const action = (request: WriteRequest) => write.mutate(request);
  const dashboardLoading = procurementDashboard.isLoading || inventoryDashboard.isLoading;

  const requisitionColumns: ColumnDef<PurchaseRequisition, unknown>[] = [
    { accessorKey: 'number', header: 'Requisição', cell: ({ row }) => <div><div className="font-semibold">{row.original.number}</div><div className="text-xs text-muted-foreground">{row.original.title}</div></div> },
    { accessorKey: 'status', header: 'Situação', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'urgency', header: 'Urgência', cell: ({ row }) => <StatusBadge status={row.original.urgency} /> },
    { id: 'requester', header: 'Solicitante', cell: ({ row }) => row.original.users?.requesterId?.name ?? 'Usuário' },
    { id: 'destination', header: 'Destino', cell: ({ row }) => row.original.warehouse.name },
    { id: 'items', header: 'Itens', cell: ({ row }) => row.original.items.length },
    { accessorKey: 'neededAt', header: 'Necessário até', cell: ({ row }) => row.original.neededAt ? formatDate(row.original.neededAt) : '—' },
    { id: 'actions', header: 'Ações', enableSorting: false, cell: ({ row }) => <div className="flex flex-wrap gap-1">{row.original.status === 'DRAFT' && <Button size="sm" variant="outline" onClick={() => action({ path: `/procurement/requisitions/${row.original.id}/submit`, success: 'Requisição enviada.' })}><Send className="mr-1 h-3.5 w-3.5" />Enviar</Button>}{canBuy && row.original.status === 'SUBMITTED' && !row.original.buyerId && <Button size="sm" onClick={() => action({ path: `/procurement/requisitions/${row.original.id}/claim`, success: 'Requisição assumida.' })}>Assumir</Button>}{canBuy && ['IN_TRIAGE', 'IN_QUOTATION', 'ORDER_CREATED'].includes(row.original.status) && <Button size="sm" variant="outline" onClick={() => setOrderFor(row.original)}><ShoppingCart className="mr-1 h-3.5 w-3.5" />Gerar pedido</Button>}{canBuy && ['IN_TRIAGE', 'IN_QUOTATION'].includes(row.original.status) && <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt('Motivo da recusa:'); if (reason) action({ path: `/procurement/requisitions/${row.original.id}/reject`, json: { reason }, success: 'Requisição recusada.' }); }}>Recusar</Button>}{row.original.requesterId === user?.id && ['DRAFT', 'SUBMITTED', 'IN_TRIAGE', 'IN_QUOTATION'].includes(row.original.status) && <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt('Motivo do cancelamento:'); if (reason) action({ path: `/procurement/requisitions/${row.original.id}/cancel`, json: { reason }, success: 'Requisição cancelada.' }); }}>Cancelar</Button>}</div> },
  ];

  const orderColumns: ColumnDef<PurchaseOrder, unknown>[] = [
    { accessorKey: 'number', header: 'Pedido', cell: ({ row }) => <div><div className="font-semibold">{row.original.number}</div><div className="text-xs text-muted-foreground">{row.original.supplier.tradeName ?? row.original.supplier.legalName}</div></div> },
    { accessorKey: 'status', header: 'Situação', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'totalAmount', header: 'Valor', cell: ({ row }) => money(row.original.totalAmount) },
    { id: 'destination', header: 'Destino', cell: ({ row }) => row.original.warehouse.name },
    { accessorKey: 'expectedDeliveryAt', header: 'Entrega', cell: ({ row }) => row.original.expectedDeliveryAt ? formatDate(row.original.expectedDeliveryAt) : '—' },
    { id: 'progress', header: 'Recebimento', cell: ({ row }) => `${sum(row.original.items, 'receivedQuantity')} / ${sum(row.original.items, 'orderedQuantity')}` },
    { id: 'actions', header: 'Ações', enableSorting: false, cell: ({ row }) => <div className="flex flex-wrap gap-1">{canBuy && ['DRAFT', 'REJECTED'].includes(row.original.status) && <Button size="sm" variant="outline" onClick={() => action({ path: `/procurement/orders/${row.original.id}/submit`, success: 'Pedido enviado para aprovação.' })}><Send className="mr-1 h-3.5 w-3.5" />Alçada</Button>}{canApprove && row.original.status === 'PENDING_APPROVAL' && canDecideOrder(row.original, user) && <><Button size="sm" onClick={() => action({ path: `/procurement/orders/${row.original.id}/approve`, success: 'Etapa aprovada.' })}><Check className="mr-1 h-3.5 w-3.5" />Aprovar</Button><Button size="sm" variant="destructive" onClick={() => { const note = window.prompt('Motivo da rejeição:'); if (note) action({ path: `/procurement/orders/${row.original.id}/reject`, json: { note }, success: 'Pedido rejeitado.' }); }}><X className="mr-1 h-3.5 w-3.5" />Rejeitar</Button></>}{canBuy && row.original.status === 'APPROVED' && <Button size="sm" onClick={() => action({ path: `/procurement/orders/${row.original.id}/send`, success: 'Pedido marcado como enviado.' })}><Truck className="mr-1 h-3.5 w-3.5" />Enviar ao fornecedor</Button>}{canOperateStock && ['SENT', 'PARTIALLY_DELIVERED'].includes(row.original.status) && <Button size="sm" onClick={() => setReceiveFor(row.original)}><PackageCheck className="mr-1 h-3.5 w-3.5" />Receber</Button>}{canBuy && row.original.status === 'DELIVERED' && <Button size="sm" variant="outline" onClick={() => action({ path: `/procurement/orders/${row.original.id}/close`, success: 'Pedido encerrado.' })}>Encerrar</Button>}{canBuy && row.original.createdById === user?.id && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_DELIVERED'].includes(row.original.status) && <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt('Motivo do cancelamento:'); if (reason) action({ path: `/procurement/orders/${row.original.id}/cancel`, json: { reason }, success: 'Pedido cancelado.' }); }}>Cancelar</Button>}</div> },
  ];

  const balanceColumns: ColumnDef<StockBalance, unknown>[] = [
    { id: 'warehouse', header: 'Almoxarifado', cell: ({ row }) => `${row.original.warehouse.code} · ${row.original.warehouse.name}` },
    { id: 'item', header: 'Item', cell: ({ row }) => <div><div className="font-semibold">{row.original.item.code} · {row.original.item.name}</div><div className="text-xs text-muted-foreground">{row.original.item.groupName ?? 'Sem grupo'}</div></div> },
    { accessorKey: 'quantity', header: 'Saldo', cell: ({ row }) => <span className={belowMinimum(row.original) ? 'font-bold text-status-red' : 'font-semibold'}>{number(row.original.quantity)} {row.original.item.unit}</span> },
    { accessorKey: 'averageCost', header: 'Custo médio', cell: ({ row }) => money(row.original.averageCost) },
    { accessorKey: 'totalValue', header: 'Valor', cell: ({ row }) => money(row.original.totalValue) },
    { id: 'minimum', header: 'Mín./Máx.', cell: ({ row }) => `${number(row.original.item.minimumStock)} / ${number(row.original.item.maximumStock)}` },
    { id: 'alert', header: 'Sinal', cell: ({ row }) => belowMinimum(row.original) ? <Badge className="border-status-red/40 text-status-red" variant="outline"><AlertTriangle className="mr-1 h-3 w-3" />Repor</Badge> : <Badge variant="outline">Normal</Badge> },
  ];

  const movementColumns: ColumnDef<StockMovement, unknown>[] = [
    { accessorKey: 'occurredAt', header: 'Data', cell: ({ row }) => new Date(row.original.occurredAt).toLocaleString('pt-BR') },
    { accessorKey: 'type', header: 'Movimento', cell: ({ row }) => <StatusBadge status={row.original.type} /> },
    { id: 'item', header: 'Item', cell: ({ row }) => `${row.original.item.code} · ${row.original.item.name}` },
    { id: 'warehouse', header: 'Almoxarifado', cell: ({ row }) => row.original.warehouse.name },
    { accessorKey: 'quantity', header: 'Quantidade', cell: ({ row }) => `${number(row.original.quantity)} ${row.original.item.unit}` },
    { id: 'balance', header: 'Saldo após', cell: ({ row }) => number(row.original.balanceAfter) },
    { accessorKey: 'originType', header: 'Origem', cell: ({ row }) => statusLabel(row.original.originType) },
    { accessorKey: 'reference', header: 'Referência', cell: ({ row }) => row.original.reference ?? '—' },
  ];

  const withdrawalColumns: ColumnDef<MaterialWithdrawal, unknown>[] = [
    { accessorKey: 'number', header: 'Retirada', cell: ({ row }) => <div><div className="font-semibold">{row.original.number}</div><div className="text-xs text-muted-foreground">{row.original.justification}</div></div> },
    { accessorKey: 'status', header: 'Situação', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: 'warehouse', header: 'Almoxarifado', cell: ({ row }) => row.original.warehouse.name },
    { id: 'items', header: 'Itens', cell: ({ row }) => row.original.items.map((line) => `${line.item.code}: ${number(line.fulfilledQuantity)}/${number(line.approvedQuantity ?? line.requestedQuantity)}`).join(' · ') },
    { accessorKey: 'createdAt', header: 'Solicitada em', cell: ({ row }) => formatDate(row.original.createdAt) },
    { id: 'actions', header: 'Ações', enableSorting: false, cell: ({ row }) => <div className="flex gap-1">{canApproveWithdrawal && row.original.status === 'REQUESTED' && <><Button size="sm" variant="outline" onClick={() => action({ path: `/inventory/withdrawals/${row.original.id}/approve`, success: 'Retirada aprovada.' })}>Aprovar</Button><Button size="sm" variant="ghost" onClick={() => { const note = window.prompt('Motivo da recusa:'); if (note) action({ path: `/inventory/withdrawals/${row.original.id}/reject`, json: { note }, success: 'Retirada recusada.' }); }}>Recusar</Button></>}{canOperateStock && ['REQUESTED', 'APPROVED', 'PARTIALLY_FULFILLED'].includes(row.original.status) && <Button size="sm" onClick={() => setFulfillFor(row.original)}>Atender e baixar</Button>}{row.original.requesterId === user?.id && ['REQUESTED', 'APPROVED', 'PARTIALLY_FULFILLED'].includes(row.original.status) && <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt('Motivo do cancelamento:'); if (reason) action({ path: `/inventory/withdrawals/${row.original.id}/cancel`, json: { reason }, success: 'Retirada cancelada.' }); }}>Cancelar</Button>}</div> },
  ];

  return <div className="space-y-4">
    <PageHeader title="Suprimentos" eyebrow="Compras & Estoque" tone="admin" description="Da requisição ao recebimento, com alçadas, saldo transacional e kardex completo por almoxarifado." actions={<div className="flex flex-wrap gap-2">{canProcurement && <Button onClick={() => setRequisitionOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova requisição</Button>}{canStock && <Button variant="outline" onClick={() => setWithdrawalOpen(true)}><Download className="mr-2 h-4 w-4" />Solicitar retirada</Button>}</div>} />
    <Tabs value={tab} onValueChange={setTab}><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="dashboard">Painel</TabsTrigger>{canProcurement && <TabsTrigger value="requisitions">Requisições</TabsTrigger>}{canProcurementOverview && <TabsTrigger value="orders">Pedidos</TabsTrigger>}{canStock && <TabsTrigger value="stock">Estoque</TabsTrigger>}{canStock && <TabsTrigger value="warehouse">Almoxarifado</TabsTrigger>}{(canStock || canProcurementOverview) && <TabsTrigger value="advanced">Serviços & Inventário</TabsTrigger>}<TabsTrigger value="registrations">Cadastros</TabsTrigger></TabsList>

      <TabsContent value="dashboard" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={ClipboardList} label="Requisições abertas" value={procurementDashboard.data?.openRequisitions ?? 0} loading={dashboardLoading} /><Metric icon={ShoppingCart} label="Fila do comprador" value={procurementDashboard.data?.buyerQueue ?? 0} loading={dashboardLoading} tone="yellow" /><Metric icon={FileCheck2} label="Aprovações pendentes" value={procurementDashboard.data?.pendingApprovals ?? 0} loading={dashboardLoading} tone="purple" /><Metric icon={Truck} label="Pedidos em curso" value={procurementDashboard.data?.openOrders ?? 0} loading={dashboardLoading} /><Metric icon={Boxes} label="Itens abaixo do mínimo" value={inventoryDashboard.data?.belowMinimum ?? 0} loading={dashboardLoading} tone="red" /><Metric icon={WarehouseIcon} label="Almoxarifados" value={inventoryDashboard.data?.warehouses ?? 0} loading={dashboardLoading} /><Metric icon={ReceiptText} label="Recebimentos no mês" value={procurementDashboard.data?.receiptsThisMonth ?? 0} loading={dashboardLoading} tone="green" /><Metric icon={Store} label="Valor em estoque" value={money(inventoryDashboard.data?.inventoryValue ?? 0)} loading={dashboardLoading} tone="green" /></div>
        {(procurementDashboard.data?.overdueOrders ?? 0) > 0 && <Card className="border-status-red/40"><CardContent className="flex items-center gap-3 p-4"><AlertTriangle className="h-5 w-5 text-status-red" /><div><div className="font-semibold">{procurementDashboard.data?.overdueOrders} pedido(s) com entrega vencida</div><div className="text-sm text-muted-foreground">O comprador responsável recebe alerta automático pelo MaintenanceScheduler.</div></div></CardContent></Card>}
        <Card><CardContent className="p-4"><div className="mb-3 font-semibold">Últimas movimentações</div><DataTable data={inventoryDashboard.data?.recentMovements ?? []} columns={movementColumns} loading={inventoryDashboard.isLoading} searchable={false} pageSize={0} emptyTitle="Nenhuma movimentação registrada" /></CardContent></Card>
      </TabsContent>

      <TabsContent value="requisitions"><DataTable data={requisitions.data ?? []} columns={requisitionColumns} loading={requisitions.isLoading} searchPlaceholder="Buscar requisição..." emptyTitle="Nenhuma requisição" emptyAction={<Button onClick={() => setRequisitionOpen(true)}>Criar requisição</Button>} /></TabsContent>
      <TabsContent value="orders"><DataTable data={orders.data ?? []} columns={orderColumns} loading={orders.isLoading} searchPlaceholder="Buscar pedido ou fornecedor..." emptyTitle="Nenhum pedido gerado" /></TabsContent>

      <TabsContent value="stock" className="space-y-4"><div className="flex flex-wrap justify-end gap-2">{canTransferStock && <Button variant="outline" onClick={() => setStockOperation('transfer')}><ArrowLeftRight className="mr-2 h-4 w-4" />Transferir</Button>}{canAdjustStock && <Button onClick={() => setStockOperation('adjust')}><Plus className="mr-2 h-4 w-4" />Ajustar saldo</Button>}</div><DataTable data={balances.data ?? []} columns={balanceColumns} loading={balances.isLoading} searchPlaceholder="Buscar item ou almoxarifado..." emptyTitle="Nenhum saldo registrado" /><div><h2 className="mb-2 text-lg font-semibold">Kardex</h2><DataTable data={movements.data ?? []} columns={movementColumns} loading={movements.isLoading} searchPlaceholder="Buscar no histórico..." emptyTitle="Nenhuma movimentação" /></div></TabsContent>
      <TabsContent value="warehouse"><div className="mb-3 flex justify-end"><Button onClick={() => setWithdrawalOpen(true)}><Download className="mr-2 h-4 w-4" />Solicitar retirada</Button></div><DataTable data={withdrawals.data ?? []} columns={withdrawalColumns} loading={withdrawals.isLoading} searchPlaceholder="Buscar retirada..." emptyTitle="Nenhuma retirada" /></TabsContent>
      <TabsContent value="advanced"><SuppliesAdvanced /></TabsContent>

      <TabsContent value="registrations" className="space-y-5"><RegistrationSection title="Almoxarifados" action={canManageStock ? <Button size="sm" onClick={() => setRegistration('warehouse')}><Plus className="mr-1 h-4 w-4" />Novo</Button> : null}><DataTable data={warehouses.data ?? []} columns={warehouseColumns} loading={warehouses.isLoading} pageSize={10} /></RegistrationSection>
        <RegistrationSection title="Itens e serviços" action={canManageStock ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />Importar XLSX</Button><Button size="sm" onClick={() => setRegistration('item')}><Plus className="mr-1 h-4 w-4" />Novo</Button></div> : null}><DataTable data={items.data ?? []} columns={itemColumns} loading={items.isLoading} pageSize={10} /></RegistrationSection>
        {canProcurement && <RegistrationSection title="Fornecedores" action={canManagePurchasing ? <Button size="sm" onClick={() => setRegistration('supplier')}><Plus className="mr-1 h-4 w-4" />Novo</Button> : null}><DataTable data={suppliers.data ?? []} columns={supplierColumns} loading={suppliers.isLoading} pageSize={10} /></RegistrationSection>}
        {canProcurement && <RegistrationSection title="Alçadas de aprovação" action={canManagePurchasing ? <Button size="sm" onClick={() => setRegistration('rule')}><Plus className="mr-1 h-4 w-4" />Nova</Button> : null}><DataTable data={rules.data ?? []} columns={ruleColumns} loading={rules.isLoading} pageSize={10} /></RegistrationSection>}
      </TabsContent>
    </Tabs>

    <RequisitionDialog open={requisitionOpen} onOpenChange={setRequisitionOpen} options={options.data} loading={write.isPending} onSubmit={(json) => action({ path: '/procurement/requisitions', json, success: 'Requisição criada.', after: () => setRequisitionOpen(false) })} />
    <OrderDialog open={!!orderFor} onOpenChange={(open) => !open && setOrderFor(null)} requisition={orderFor} options={options.data} loading={write.isPending} onSubmit={(json) => action({ path: '/procurement/orders', json, success: 'Pedido gerado em rascunho.', after: () => setOrderFor(null) })} />
    <ReceiveDialog open={!!receiveFor} onOpenChange={(open) => !open && setReceiveFor(null)} order={receiveFor} loading={write.isPending} onSubmit={(json) => action({ path: `/procurement/orders/${receiveFor?.id}/receive`, json, success: 'Recebimento processado e estoque atualizado.', after: () => setReceiveFor(null) })} />
    <WithdrawalDialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen} options={options.data} loading={write.isPending} onSubmit={(json) => action({ path: '/inventory/withdrawals', json, success: 'Retirada solicitada.', after: () => setWithdrawalOpen(false) })} />
    <FulfillDialog open={!!fulfillFor} onOpenChange={(open) => !open && setFulfillFor(null)} withdrawal={fulfillFor} loading={write.isPending} onSubmit={(json) => action({ path: `/inventory/withdrawals/${fulfillFor?.id}/fulfill`, json, success: 'Retirada atendida e baixa registrada.', after: () => setFulfillFor(null) })} />
    <StockOperationDialog open={!!stockOperation} onOpenChange={(open) => !open && setStockOperation(null)} mode={stockOperation ?? 'adjust'} options={options.data} loading={write.isPending} onSubmit={(json) => action({ path: stockOperation === 'transfer' ? '/inventory/movements/transfer' : '/inventory/movements/adjust', json, success: stockOperation === 'transfer' ? 'Transferência concluída.' : 'Ajuste registrado.', after: () => setStockOperation(null) })} />
    <RegistrationDialog open={!!registration} onOpenChange={(open) => !open && setRegistration(null)} kind={registration ?? 'item'} options={options.data} loading={write.isPending} onSubmit={(json) => action({ path: registration === 'warehouse' ? '/inventory/warehouses' : registration === 'item' ? '/inventory/items' : registration === 'supplier' ? '/procurement/suppliers' : '/procurement/approval-rules', json, success: 'Cadastro salvo.', after: () => setRegistration(null) })} />
    <ImportDialog open={importOpen} onOpenChange={setImportOpen} warehouses={options.data?.warehouses} loading={write.isPending} onSubmit={(json) => action({ path: '/inventory/imports/catalog', json, success: 'Catálogo importado.', after: () => setImportOpen(false) })} />
  </div>;
}

const warehouseColumns: ColumnDef<Warehouse, unknown>[] = [
  { accessorKey: 'code', header: 'Código' }, { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'address', header: 'Localização', cell: ({ row }) => row.original.address ?? '—' },
  { accessorKey: 'allowNegative', header: 'Saldo negativo', cell: ({ row }) => row.original.allowNegative ? 'Permitido' : 'Bloqueado' },
  { accessorKey: 'active', header: 'Situação', cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} /> },
];
const itemColumns: ColumnDef<StockItem, unknown>[] = [
  { accessorKey: 'code', header: 'Código' }, { accessorKey: 'name', header: 'Item' }, { accessorKey: 'kind', header: 'Tipo', cell: ({ row }) => statusLabel(row.original.kind) },
  { accessorKey: 'unit', header: 'Unidade' }, { accessorKey: 'groupName', header: 'Grupo', cell: ({ row }) => row.original.groupName ?? '—' },
  { accessorKey: 'minimumStock', header: 'Mínimo', cell: ({ row }) => number(row.original.minimumStock) }, { accessorKey: 'averageCost', header: 'Custo médio', cell: ({ row }) => money(row.original.averageCost) },
];
const supplierColumns: ColumnDef<Supplier, unknown>[] = [
  { accessorKey: 'code', header: 'Código' }, { accessorKey: 'legalName', header: 'Razão social' }, { accessorKey: 'tradeName', header: 'Nome fantasia', cell: ({ row }) => row.original.tradeName ?? '—' },
  { accessorKey: 'documentNumber', header: 'Documento', cell: ({ row }) => row.original.documentNumber ?? '—' }, { accessorKey: 'email', header: 'Contato', cell: ({ row }) => row.original.email ?? row.original.phone ?? '—' },
];
const ruleColumns: ColumnDef<ApprovalRule, unknown>[] = [
  { accessorKey: 'level', header: 'Nível' }, { accessorKey: 'name', header: 'Alçada' }, { accessorKey: 'minimumAmount', header: 'De', cell: ({ row }) => money(row.original.minimumAmount) },
  { accessorKey: 'maximumAmount', header: 'Até', cell: ({ row }) => row.original.maximumAmount == null ? 'Sem limite' : money(row.original.maximumAmount) },
  { id: 'approver', header: 'Aprovador', cell: ({ row }) => row.original.users?.approverUserId?.name ?? roleLabel(row.original.approverRole) },
  { accessorKey: 'active', header: 'Situação', cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} /> },
];

function Metric({ icon: Icon, label, value, loading, tone = 'blue' }: { icon: typeof Boxes; label: string; value: string | number; loading?: boolean; tone?: string }) { const colors: Record<string, string> = { blue: 'text-status-blue bg-status-blue/10', yellow: 'text-status-yellow bg-status-yellow/10', red: 'text-status-red bg-status-red/10', green: 'text-status-green bg-status-green/10', purple: 'text-status-purple bg-status-purple/10' }; return <Card><CardContent className="flex items-center gap-3 p-4"><div className={`rounded-lg p-2 ${colors[tone]}`}><Icon className="h-5 w-5" /></div><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="text-2xl font-semibold">{loading ? '—' : value}</div></div></CardContent></Card>; }
function RegistrationSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <section><div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2>{action}</div>{children}</section>; }
function StatusBadge({ status }: { status: string }) { const normalized = status.toUpperCase(); const className = normalized.includes('REJECT') || normalized.includes('CANCEL') || normalized === 'CRITICAL' ? 'border-status-red/40 text-status-red' : normalized.includes('APPROV') || normalized.includes('FULFILL') || normalized.includes('DELIVERED') || normalized === 'ACTIVE' || normalized === 'IN' ? 'border-status-green/40 text-status-green' : normalized.includes('PENDING') || normalized.includes('SUBMIT') || normalized === 'HIGH' ? 'border-status-yellow/40 text-status-yellow' : 'border-status-blue/40 text-status-blue'; return <Badge variant="outline" className={className}>{statusLabel(status)}</Badge>; }
function statusLabel(value: string) { const map: Record<string, string> = { DRAFT: 'Rascunho', SUBMITTED: 'Enviada', IN_TRIAGE: 'Em triagem', IN_QUOTATION: 'Em cotação', ORDER_CREATED: 'Pedido gerado', PARTIALLY_FULFILLED: 'Atendida parcial', FULFILLED: 'Atendida', PENDING_APPROVAL: 'Aguardando aprovação', APPROVED: 'Aprovado', REJECTED: 'Rejeitado', SENT: 'Enviado', PARTIALLY_DELIVERED: 'Entrega parcial', DELIVERED: 'Entregue', CLOSED: 'Encerrado', CANCELLED: 'Cancelado', REQUESTED: 'Solicitada', PARTIALLY_FULFILLED_WITHDRAWAL: 'Atendida parcial', ACTIVE: 'Ativo', INACTIVE: 'Inativo', LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta', CRITICAL: 'Crítica', MATERIAL: 'Material', SERVICE: 'Serviço', IN: 'Entrada', OUT: 'Saída', TRANSFER_IN: 'Transferência (entrada)', TRANSFER_OUT: 'Transferência (saída)', ADJUST: 'Ajuste', PURCHASE_RECEIPT: 'Recebimento', WITHDRAWAL: 'Retirada', TRANSFER: 'Transferência', ADJUSTMENT: 'Ajuste', IMPORT: 'Importação' }; return map[value] ?? value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()); }
function roleLabel(value?: string | null) { return ({ MANAGER: 'Gestor', DIRECTOR: 'Diretoria', COMPANY_ADMIN: 'Administrador' } as Record<string, string>)[value ?? ''] ?? 'Aprovador com permissão'; }
function money(value: unknown) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0)); }
function number(value: unknown) { return value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(value)); }
function sum(rows: PurchaseOrder['items'], key: 'receivedQuantity' | 'orderedQuantity') { return number(rows.reduce((total, row) => total + Number(row[key]), 0)); }
function belowMinimum(row: StockBalance) { return row.item.minimumStock != null && Number(row.quantity) < Number(row.item.minimumStock); }
function canDecideOrder(order: PurchaseOrder, user: { id: string; role: string } | null) { if (!user) return false; if (['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user.role)) return true; const current = order.approvals.find((step) => step.status === 'PENDING'); if (!current) return false; return current.approverUserId ? current.approverUserId === user.id : current.approverRole ? current.approverRole === user.role : true; }
