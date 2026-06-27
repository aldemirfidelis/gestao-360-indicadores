'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, CircleAlert, KeyRound, Search, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ACCESS_ROLE_DEFINITIONS,
  ACCESS_LEVELS,
  BUSINESS_MODULE_DEFINITIONS,
  getActionLabel,
  getBusinessModule,
  getFeatureLabel,
  isPermissionCompatibleWithRole,
  isDeprecatedPermissionKey,
  isSensitivePermission,
  type PermissionRecord,
} from '@/lib/access-control';

interface PermissionMatrixProps {
  permissions: PermissionRecord[];
  selectedKeys: string[];
  inheritedKeys?: string[];
  role?: string | null;
  onChange: (keys: string[]) => void;
  title?: string;
  description?: string;
  compact?: boolean;
}

export function PermissionMatrix({
  permissions,
  selectedKeys,
  inheritedKeys = [],
  role,
  onChange,
  title = 'Permissões por módulo',
  description = 'Escolha um nível rápido por módulo e ajuste os acessos específicos quando necessário.',
  compact = false,
}: PermissionMatrixProps) {
  const [search, setSearch] = useState('');
  const activeSelectedKeys = useMemo(() => selectedKeys.filter((key) => !isDeprecatedPermissionKey(key)), [selectedKeys]);
  const activeInheritedKeys = useMemo(() => inheritedKeys.filter((key) => !isDeprecatedPermissionKey(key)), [inheritedKeys]);
  const selected = useMemo(() => new Set(activeSelectedKeys), [activeSelectedKeys]);
  const inherited = useMemo(() => new Set(activeInheritedKeys), [activeInheritedKeys]);
  const effective = useMemo(() => new Set([...activeSelectedKeys, ...activeInheritedKeys]), [activeSelectedKeys, activeInheritedKeys]);
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

  const modules = useMemo(
    () =>
      BUSINESS_MODULE_DEFINITIONS.map((module) => {
        const items = permissions.filter(
          (permission) => !isDeprecatedPermissionKey(permission.key) && getBusinessModule(permission).slug === module.slug,
        );
        const visibleItems = normalizedSearch
          ? items.filter((permission) =>
              [permission.description, permission.key, permission.module, module.title]
                .join(' ')
                .toLocaleLowerCase('pt-BR')
                .includes(normalizedSearch),
            )
          : items;
        return { ...module, items, visibleItems };
      }).filter((module) => !normalizedSearch || module.visibleItems.length > 0 || module.title.toLocaleLowerCase('pt-BR').includes(normalizedSearch)),
    [normalizedSearch, permissions],
  );

  function togglePermission(permission: PermissionRecord, checked: boolean) {
    if (inherited.has(permission.key)) return;
    if (checked && !isPermissionCompatibleWithRole(permission, role)) return;
    const next = new Set(activeSelectedKeys);
    if (checked) next.add(permission.key);
    else next.delete(permission.key);
    onChange(Array.from(next));
  }

  function setModuleLevel(moduleKeys: string[], level: (typeof ACCESS_LEVELS)[number]) {
    const modulePermissions = permissions.filter((permission) => moduleKeys.includes(permission.key));
    const compatible = modulePermissions.filter((permission) => isPermissionCompatibleWithRole(permission, role));
    const allowedActions = level.actions as readonly string[] | null;
    const next = new Set(activeSelectedKeys);
    modulePermissions.forEach((permission) => next.delete(permission.key));
    compatible
      .filter((permission) => allowedActions === null || allowedActions.includes(permission.action))
      .forEach((permission) => {
        if (!inherited.has(permission.key)) next.add(permission.key);
      });
    onChange(Array.from(next));
  }

  function toggleFeature(items: PermissionRecord[]) {
    const compatible = items.filter((permission) => isPermissionCompatibleWithRole(permission, role) && !inherited.has(permission.key));
    const allSelected = compatible.length > 0 && compatible.every((permission) => selected.has(permission.key));
    const next = new Set(activeSelectedKeys);
    compatible.forEach((permission) => {
      if (allSelected) next.delete(permission.key);
      else next.add(permission.key);
    });
    onChange(Array.from(next));
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{title}</h3>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{effective.size} efetivas</Badge>
            {inherited.size > 0 && <Badge variant="outline">{inherited.size} pelo perfil</Badge>}
            <Badge variant="outline">{selected.size} individuais</Badge>
            {selected.size > 0 && (
              <Button size="sm" variant="ghost" onClick={() => onChange([])}>
                Limpar individuais
              </Button>
            )}
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar módulo ou ação, por exemplo: aprovar documento..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className={cn('space-y-3 p-3', compact ? 'max-h-[520px] overflow-y-auto' : 'max-h-[640px] overflow-y-auto')}>
        {modules.map((module, moduleIndex) => {
          const moduleKeys = module.items.map((permission) => permission.key);
          const effectiveCount = module.items.filter((permission) => effective.has(permission.key)).length;
          const features = Array.from(
            module.visibleItems.reduce((map, permission) => {
              const feature = getFeatureLabel(permission.module);
              if (!map.has(feature)) map.set(feature, []);
              map.get(feature)!.push(permission);
              return map;
            }, new Map<string, PermissionRecord[]>()),
          );

          return (
            <details
              key={module.slug}
              className="group overflow-hidden rounded-lg border bg-background"
              open={normalizedSearch ? true : undefined}
              {...(!normalizedSearch && moduleIndex < 1 ? { defaultOpen: true } : {})}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{module.title}</h4>
                    {module.items.length > 0 ? (
                      <Badge variant={effectiveCount > 0 ? 'secondary' : 'outline'}>
                        {effectiveCount}/{module.items.length}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Acesso padrão</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
                </div>
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>

              <div className="border-t p-4">
                {module.standardAccess && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                    {module.standardAccess}
                  </div>
                )}

                {module.items.length > 0 && (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-xs font-medium text-muted-foreground">Acesso rápido:</span>
                      {ACCESS_LEVELS.map((level) => (
                        <Button
                          key={level.value}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setModuleLevel(moduleKeys, level)}
                        >
                          {level.label}
                        </Button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      {features.map(([feature, items]) => {
                        const compatibleItems = items.filter((permission) => isPermissionCompatibleWithRole(permission, role));
                        const allDirect = compatibleItems.length > 0 && compatibleItems.every((permission) => selected.has(permission.key) || inherited.has(permission.key));
                        return (
                          <section key={feature}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{feature}</h5>
                              {compatibleItems.length > 0 && (
                                <button type="button" onClick={() => toggleFeature(items)} className="text-xs font-medium text-primary hover:underline">
                                  {allDirect ? 'Limpar grupo' : 'Marcar grupo'}
                                </button>
                              )}
                            </div>
                            <div className="grid gap-2 lg:grid-cols-2">
                              {items.map((permission) => {
                                const fromProfile = inherited.has(permission.key);
                                const compatible = isPermissionCompatibleWithRole(permission, role);
                                const checked = fromProfile || selected.has(permission.key);
                                const canToggle = !fromProfile && (compatible || selected.has(permission.key));
                                return (
                                  <label
                                    key={permission.key}
                                    className={cn(
                                      'flex items-start gap-3 rounded-lg border p-3 text-sm',
                                      canToggle && 'cursor-pointer hover:bg-accent/35',
                                      checked && 'border-primary/35 bg-primary/5',
                                      !compatible && 'cursor-not-allowed bg-muted/40 opacity-65',
                                    )}
                                  >
                                    <input
                                      className="mt-1"
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!canToggle}
                                      onChange={(event) => togglePermission(permission, event.target.checked)}
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-medium leading-5">{permission.description}</span>
                                        <Badge variant="outline" className="text-[10px]">{getActionLabel(permission.action)}</Badge>
                                        {isSensitivePermission(permission) && (
                                          <Badge variant="destructive" className="text-[10px]">Sensível</Badge>
                                        )}
                                        {fromProfile && <Badge variant="secondary" className="text-[10px]">Pelo perfil</Badge>}
                                      </span>
                                      {!compatible ? (
                                        <span className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                                          <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                                          Exige o papel Administrador da empresa.
                                        </span>
                                      ) : (
                                        <span className="mt-1 block font-mono text-[10px] text-muted-foreground/75">{permission.key}</span>
                                      )}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </details>
          );
        })}

        {modules.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma permissão encontrada para a busca informada.
          </div>
        )}
      </div>
    </div>
  );
}

export function AccessRoleGuide({ selectedRole }: { selectedRole?: string | null }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {ACCESS_ROLE_DEFINITIONS.map((role) => (
        <div
          key={role.value}
          className={cn(
            'rounded-lg border bg-background p-3',
            selectedRole === role.value && 'border-primary/40 bg-primary/5',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{role.label}</div>
            {selectedRole === role.value && <Badge variant="secondary">Selecionado</Badge>}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{role.description}</p>
          <p className="mt-2 text-[11px] font-medium text-foreground">{role.recommendedFor}</p>
        </div>
      ))}
    </div>
  );
}
