'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isProductModuleActive, type ProcessIntegrationType } from '@g360/shared';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { RelatedTarget } from './types';

export function EntityPicker({ type, selected, onChange, disabled = false, multiple = true, label }: {
  type: ProcessIntegrationType; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean; multiple?: boolean; label: string;
}) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const moduleCode = ({ DOCUMENT: 'documents', FORM: 'forms', RISK: 'risks', AUDIT: 'audits', TRAINING: 'training' } as Partial<Record<ProcessIntegrationType, string>>)[type];
  const available = !moduleCode || isProductModuleActive(moduleCode);
  useEffect(() => { const timer = setTimeout(() => setTerm(search), 300); return () => clearTimeout(timer); }, [search]);
  const selectedKey = selected.join(',');
  const query = useQuery({ queryKey: ['process-targets', type, term, selectedKey], queryFn: () => api<{ items: RelatedTarget[]; selectedItems: RelatedTarget[] }>(`/processes/governance/targets?type=${type}&search=${encodeURIComponent(term)}&selected=${encodeURIComponent(selectedKey)}`), enabled: available && (!disabled || selected.length > 0), staleTime: 20_000 });
  if (!available) return <p className="text-xs text-muted-foreground">Este módulo está desativado. Os vínculos existentes são preservados.</p>;
  return <div className="space-y-2">
    {!disabled && <Input aria-label={`Buscar ${label}`} placeholder={`Buscar ${label.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} />}
    {!disabled && <NativeSelect aria-label={`Selecionar ${label}`} value="" disabled={query.isLoading || query.isError} onChange={(event) => { if (event.target.value) onChange(multiple ? [...new Set([...selected, event.target.value])] : [event.target.value]); }}>
      <option value="">{query.isLoading ? 'Carregando...' : `Selecionar ${label.toLowerCase()}`}</option>
      {(query.data?.items ?? []).filter((item) => !selected.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </NativeSelect>}
    {query.isError && <p role="alert" className="text-xs text-muted-foreground">{query.error.message}</p>}
    <div className="flex flex-wrap gap-2">{selected.map((id) => { const target = query.data?.selectedItems.find((item) => item.id === id) ?? query.data?.items.find((item) => item.id === id); return <div key={id} className="inline-flex max-w-full items-center gap-2 rounded border px-2 py-1 text-xs">{target ? <a href={target.href} className="truncate text-primary hover:underline">{target.name}</a> : <span>Registro vinculado indisponível</span>}{!disabled && <Button size="sm" variant="ghost" className="h-5 px-1" aria-label={`Remover ${label}`} onClick={() => onChange(selected.filter((item) => item !== id))}>×</Button>}</div>; })}</div>
  </div>;
}
