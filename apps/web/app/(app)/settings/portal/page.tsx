'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, Archive, Boxes, FileText, Flag, GitBranch, KeyRound, LayoutDashboard,
  Megaphone, Network, Plug, ScrollText, SlidersHorizontal, Stethoscope, Wrench,
  type LucideIcon,
} from 'lucide-react';
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

type TabKey =
  | 'overview' | 'modules' | 'pages' | 'features' | 'navigation' | 'permissions' | 'scope'
  | 'maintenance' | 'parameters' | 'integrations' | 'announcements' | 'audit' | 'snapshots'
  | 'diagnostics' | 'advanced';

interface TabItem { key: TabKey; label: string; icon: LucideIcon }
interface TabGroup { heading: string; items: TabItem[] }

const GROUPS: TabGroup[] = [
  {
    heading: 'Visão',
    items: [
      { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
      { key: 'diagnostics', label: 'Diagnóstico', icon: Stethoscope },
      { key: 'audit', label: 'Auditoria', icon: ScrollText },
    ],
  },
  {
    heading: 'Estrutura',
    items: [
      { key: 'modules', label: 'Módulos', icon: Boxes },
      { key: 'pages', label: 'Páginas', icon: FileText },
      { key: 'features', label: 'Funcionalidades', icon: Flag },
      { key: 'navigation', label: 'Menus e Navegação', icon: Network },
    ],
  },
  {
    heading: 'Acesso',
    items: [
      { key: 'permissions', label: 'Perfis e Permissões', icon: KeyRound },
      { key: 'scope', label: 'Escopo Organizacional', icon: GitBranch },
    ],
  },
  {
    heading: 'Operação',
    items: [
      { key: 'maintenance', label: 'Manutenção', icon: Wrench },
      { key: 'integrations', label: 'Integrações', icon: Plug },
      { key: 'announcements', label: 'Avisos e Comunicados', icon: Megaphone },
    ],
  },
  {
    heading: 'Sistema',
    items: [
      { key: 'parameters', label: 'Parâmetros Gerais', icon: SlidersHorizontal },
      { key: 'snapshots', label: 'Histórico e Restauração', icon: Archive },
      { key: 'advanced', label: 'Configurações Avançadas', icon: Activity },
    ],
  },
];

const TAB_CONTENT: Record<TabKey, React.ReactNode> = {
  overview: <OverviewTab />,
  modules: <ModulesTab />,
  pages: <PagesTab />,
  features: <FeaturesTab />,
  navigation: <NavigationTab />,
  permissions: <PermissionsTab />,
  scope: <ScopeTab />,
  maintenance: <MaintenanceTab />,
  parameters: <ParametersTab />,
  integrations: <IntegrationsTab />,
  announcements: <AnnouncementsTab />,
  audit: <AuditTab />,
  snapshots: <SnapshotsTab />,
  diagnostics: <DiagnosticsTab />,
  advanced: <AdvancedTab />,
};

export default function PortalAdminPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const activeLabel = GROUPS.flatMap((g) => g.items).find((i) => i.key === tab)?.label ?? '';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[248px,1fr]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="panel overflow-hidden">
          <div className="border-b px-4 py-3 text-sm font-semibold">Central do Portal</div>
          <nav className="p-2">
            {GROUPS.map((group) => (
              <div key={group.heading} className="mb-2">
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">{group.heading}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTab(item.key)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                        active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <section className="min-w-0">
        <div className="panel p-4">
          <h2 className="mb-4 text-base font-semibold">{activeLabel}</h2>
          {TAB_CONTENT[tab]}
        </div>
      </section>
    </div>
  );
}
