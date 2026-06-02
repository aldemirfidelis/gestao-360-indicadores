'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { TabsBar, type TabDef } from '@/components/portal-admin/tabs-bar';
import { OverviewTab } from '@/components/portal-admin/tabs/overview-tab';
import { ModulesTab } from '@/components/portal-admin/tabs/modules-tab';
import { PagesTab } from '@/components/portal-admin/tabs/pages-tab';
import { FeaturesTab } from '@/components/portal-admin/tabs/features-tab';
import { NavigationTab } from '@/components/portal-admin/tabs/navigation-tab';
import { ScopeTab } from '@/components/portal-admin/tabs/scope-tab';
import { MaintenanceTab } from '@/components/portal-admin/tabs/maintenance-tab';
import { PermissionsTab } from '@/components/portal-admin/tabs/permissions-tab';
import { ParametersTab } from '@/components/portal-admin/tabs/parameters-tab';
import { IntegrationsTab } from '@/components/portal-admin/tabs/integrations-tab';
import { AnnouncementsTab } from '@/components/portal-admin/tabs/announcements-tab';
import { AuditTab } from '@/components/portal-admin/tabs/audit-tab';
import { SnapshotsTab } from '@/components/portal-admin/tabs/snapshots-tab';
import { DiagnosticsTab } from '@/components/portal-admin/tabs/diagnostics-tab';
import { AdvancedTab } from '@/components/portal-admin/tabs/advanced-tab';

const TABS: TabDef[] = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'modules', label: 'Módulos' },
  { key: 'pages', label: 'Páginas' },
  { key: 'features', label: 'Funcionalidades' },
  { key: 'navigation', label: 'Menus e Navegação' },
  { key: 'permissions', label: 'Perfis e Permissões' },
  { key: 'scope', label: 'Escopo Organizacional' },
  { key: 'maintenance', label: 'Manutenção' },
  { key: 'parameters', label: 'Parâmetros Gerais' },
  { key: 'integrations', label: 'Integrações' },
  { key: 'announcements', label: 'Avisos e Comunicados' },
  { key: 'audit', label: 'Auditoria' },
  { key: 'snapshots', label: 'Histórico e Restauração' },
  { key: 'diagnostics', label: 'Diagnóstico' },
  { key: 'advanced', label: 'Configurações Avançadas' },
];

export default function PortalAdminPage() {
  const [tab, setTab] = useState('overview');

  return (
    <Card className="overflow-hidden">
      <TabsBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="p-4">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'modules' && <ModulesTab />}
        {tab === 'pages' && <PagesTab />}
        {tab === 'features' && <FeaturesTab />}
        {tab === 'navigation' && <NavigationTab />}
        {tab === 'scope' && <ScopeTab />}
        {tab === 'maintenance' && <MaintenanceTab />}
        {tab === 'permissions' && <PermissionsTab />}
        {tab === 'parameters' && <ParametersTab />}
        {tab === 'integrations' && <IntegrationsTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'snapshots' && <SnapshotsTab />}
        {tab === 'diagnostics' && <DiagnosticsTab />}
        {tab === 'advanced' && <AdvancedTab />}
      </div>
    </Card>
  );
}
