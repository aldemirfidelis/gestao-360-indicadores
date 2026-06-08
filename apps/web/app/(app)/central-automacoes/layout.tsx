'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  GitBranch,
  PlayCircle,
  FileText,
  Boxes,
  ClipboardList,
  AlertTriangle,
  FolderLock,
  Layers,
  Settings,
  History,
  Workflow,
  PlusCircle,
  Clock,
} from 'lucide-react';

const SUBMENU_ITEMS = [
  { href: '/central-automacoes', label: 'Visão Geral', icon: Layers, exact: true },
  { href: '/central-automacoes/fluxos', label: 'Meus Fluxos', icon: GitBranch, exact: true },
  { href: '/central-automacoes/fluxos/construtor', label: 'Criar Fluxo', icon: PlusCircle, exact: false },
  { href: '/central-automacoes/biblioteca', label: 'Biblioteca de Blocos', icon: Boxes, exact: true },
  { href: '/central-automacoes/modelos', label: 'Modelos Prontos', icon: Workflow, exact: true },
  { href: '/central-automacoes/execucoes', label: 'Execuções', icon: PlayCircle, exact: false },
  { href: '/central-automacoes/aprovacoes', label: 'Aprovações', icon: FolderLock, exact: true },
  { href: '/central-automacoes/tarefas', label: 'Tarefas Geradas', icon: ClipboardList, exact: true },
  { href: '/central-automacoes/escalonamentos', label: 'Prazos & SLAs', icon: Clock, exact: true },
  { href: '/central-automacoes/falhas', label: 'Falhas e Pendências', icon: AlertTriangle, exact: true },
  { href: '/central-automacoes/integracoes', label: 'Integrações', icon: Settings, exact: true },
  { href: '/central-automacoes/configuracoes', label: 'Configurações', icon: Settings, exact: true },
  { href: '/central-automacoes/historico', label: 'Histórico', icon: History, exact: true },
  { href: '/central-automacoes/permissoes', label: 'Permissões', icon: FolderLock, exact: true },
];

export default function AutomationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide the left submenu sidebar in the constructor view to give maximum canvas screen space
  const isConstructor = pathname.includes('/fluxos/construtor');

  return (
    <div className="flex h-[calc(100vh-65px)] min-h-0 w-full overflow-hidden bg-background">
      {!isConstructor && (
        <aside className="w-64 border-r bg-card/65 backdrop-blur-md flex flex-col min-h-0 shrink-0">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              Central de Automações
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Gestão e Motor de Processos</p>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {SUBMENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col min-h-0 bg-muted/20">
        {children}
      </main>
    </div>
  );
}
