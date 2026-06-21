'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import { useAssetSecurityDashboard } from '@/hooks/asset-security/use-asset-security-dashboard';
import { MovementDetailDialog } from '@/components/asset-security/movement-detail-dialog';
import type { SecurityMovement } from '@/lib/asset-security/types';
import type { TabKey, EntityDialogState } from '@/components/seguranca-patrimonial/types';
import {
  TABS,
  isTab,
  OverviewTab,
  OperationTab,
  PeopleTab,
  AuthorizationsTab,
  RoundsTab,
  AssetsTab,
  SettingsTab,
} from '@/components/seguranca-patrimonial/tabs';
import {
  EntityDialog,
  EntryDialog,
  ExitDialog,
  QrValidateDialog,
} from '@/components/seguranca-patrimonial/dialogs';
import { buildOptions, personDialog } from '@/components/seguranca-patrimonial/dialog-configs';

export default function SegurancaPatrimonialPage() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['asset-security:create', 'asset-security:manage']);
  const canOperate = hasPermission(['asset-security:entry', 'asset-security:exit', 'asset-security:update']);
  const canApprove = hasPermission(['asset-security:approve', 'asset-security:manage']);
  const canManage = hasPermission(['asset-security:manage']);
  const canUpdate = hasPermission(['asset-security:update', 'asset-security:manage']);
  const canIncident = hasPermission(['asset-security:incident', 'asset-security:manage']);
  const canRounds = hasPermission(['asset-security:rounds', 'asset-security:manage']);
  const canHandover = hasPermission(['asset-security:handover', 'asset-security:manage']);
  const canBlock = hasPermission(['asset-security:block', 'asset-security:manage']);
  const canOffline = hasPermission(['asset-security:offline', 'asset-security:manage']);
  const initialTab = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as TabKey) : 'overview';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [dialog, setDialog] = useState<EntityDialogState | null>(null);
  const [search, setSearch] = useState('');
  const [entryOpen, setEntryOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [detail, setDetail] = useState<SecurityMovement | null>(null);

  useEffect(() => {
    const next = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as TabKey) : 'overview';
    setTab(next);
  }, [searchParams]);

  const {
    summary,
    options,
    gates,
    posts,
    people,
    vehicles,
    authorizations,
    present,
    pending,
    movements,
    incidents,
    roundExecutions,
    custody,
    materials,
    logbook,
    insights,
    packageConfig,
    invalidateAssetSecurity,
  } = useAssetSecurityDashboard({ canManage, search, tab });

  function invalidate() {
    invalidateAssetSecurity();
  }

  function selectTab(next: TabKey) {
    setTab(next);
    if (typeof window !== 'undefined') {
      const url = next === 'overview' ? '/seguranca-patrimonial' : `/seguranca-patrimonial?tab=${next}`;
      window.history.replaceState(null, '', url);
    }
  }

  const optionValues = useMemo(() => buildOptions(options.data), [options.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Corporativo"
        tone="admin"
        title="Segurança Patrimonial"
        description="Controle de portarias, acessos, visitantes, prestadores, veículos, rondas, ocorrências, chaves, crachás, código QR e operação sem conexão."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Segurança Patrimonial' }]}
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => selectTab(item.key)}
              className={cn('flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors', tab === item.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <OverviewTab
          summary={summary.data}
          insights={insights.data}
          movements={movements.data ?? []}
          incidents={incidents.data ?? []}
          roundExecutions={roundExecutions.data ?? []}
          totalRecords={(options.data?.people?.length ?? 0) + (options.data?.vehicles?.length ?? 0) + (options.data?.contractorCompanies?.length ?? 0)}
          loading={summary.isPending}
          onTab={selectTab}
        />
      )}

      {tab === 'operation' && (
        <OperationTab
          present={present.data ?? []}
          pending={pending.data ?? []}
          gates={gates.data ?? []}
          loading={present.isPending || pending.isPending}
          canOperate={canOperate}
          optionValues={optionValues}
          onEntry={() => setEntryOpen(true)}
          onExit={() => setExitOpen(true)}
          onDialog={setDialog}
          onDetail={setDetail}
          onQr={() => setQrOpen(true)}
        />
      )}

      {tab === 'people' && (
        <PeopleTab
          people={people.data ?? []}
          vehicles={vehicles.data ?? []}
          contractorCompanies={options.data?.contractorCompanies ?? []}
          loading={people.isPending || vehicles.isPending}
          search={search}
          setSearch={setSearch}
          canCreate={canCreate}
          optionValues={optionValues}
          onDialog={setDialog}
          onChanged={invalidate}
        />
      )}

      {tab === 'authorizations' && (
        <AuthorizationsTab
          rows={authorizations.data ?? []}
          loading={authorizations.isPending}
          canCreate={canCreate}
          canApprove={canApprove}
          optionValues={optionValues}
          onDialog={setDialog}
          onChanged={invalidate}
        />
      )}

      {tab === 'rounds' && (
        <RoundsTab
          logbook={logbook.data ?? []}
          loading={logbook.isPending}
          optionValues={optionValues}
          canIncident={canIncident}
          canRounds={canRounds}
          canHandover={canHandover}
        />
      )}

      {tab === 'assets' && (
        <AssetsTab
          custody={custody.data ?? []}
          materials={materials.data ?? []}
          loading={custody.isPending || materials.isPending}
          canCreate={canOperate}
          canUpdate={canUpdate}
          optionValues={optionValues}
          onDialog={setDialog}
          onChanged={invalidate}
        />
      )}

      {tab === 'settings' && (
        <SettingsTab
          gates={gates.data ?? []}
          posts={posts.data ?? []}
          packageConfig={packageConfig.data}
          summary={summary.data}
          loading={gates.isPending || posts.isPending}
          canManage={canManage}
          canBlock={canBlock}
          canOffline={canOffline}
          optionValues={optionValues}
          onDialog={setDialog}
        />
      )}

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); invalidate(); }} />}
      {entryOpen && <EntryDialog optionValues={optionValues} onCreatePerson={(defaults) => { setEntryOpen(false); setDialog(personDialog(optionValues, undefined, defaults)); }} onClose={() => setEntryOpen(false)} onSaved={() => { setEntryOpen(false); invalidate(); }} />}
      {exitOpen && <ExitDialog openMovements={present.data ?? []} onClose={() => setExitOpen(false)} onSaved={() => { setExitOpen(false); invalidate(); }} />}
      {qrOpen && <QrValidateDialog onClose={() => setQrOpen(false)} />}
      <MovementDetailDialog movement={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
