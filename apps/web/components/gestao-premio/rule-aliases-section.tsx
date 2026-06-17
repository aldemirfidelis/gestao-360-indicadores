'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, ArrowLeftRight, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';

interface Alias {
  id: string;
  kind: 'AREA' | 'POSITION';
  sourceValue: string;
  normalizedKey: string;
  canonicalName: string | null;
  active: boolean;
}

export function RuleAliasesSection({ canAdmin }: { canAdmin: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'AREA', sourceValue: '', canonicalName: '' });

  const { data: aliases = [] } = useQuery({
    queryKey: ['prize-rule-aliases'],
    queryFn: () => api<Alias[]>('/prize/rules/aliases'),
    enabled: open,
  });

  const upsert = useMutation({
    mutationFn: () => api('/prize/rules/aliases', { method: 'POST', json: { kind: form.kind, sourceValue: form.sourceValue.trim(), canonicalName: form.canonicalName.trim() || null } }),
    onSuccess: () => { toast.success('De-para salvo'); setForm({ ...form, sourceValue: '', canonicalName: '' }); qc.invalidateQueries({ queryKey: ['prize-rule-aliases'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const groups: { kind: 'AREA' | 'POSITION'; label: string }[] = [{ kind: 'AREA', label: 'Áreas' }, { kind: 'POSITION', label: 'Cargos' }];

  return (
    <Card>
      <CardContent className="p-0">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">De-para de área e cargo (normalização do Apdata)</span>
          <span className="text-xs text-muted-foreground">— mapeia nomes vindos da base elegível para os nomes das regras, reduzindo “não casados”.</span>
        </button>
        {open && (
          <div className="space-y-3 border-t border-border/60 p-4">
            {canAdmin && (
              <div className="grid grid-cols-1 gap-2 rounded-md border border-dashed border-border/60 p-3 md:grid-cols-4">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <NativeSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                    <option value="AREA">Área</option>
                    <option value="POSITION">Cargo</option>
                  </NativeSelect>
                </div>
                <div><Label className="text-xs">Nome de origem (Apdata)</Label><Input value={form.sourceValue} onChange={(e) => setForm({ ...form, sourceValue: e.target.value })} placeholder="Ex.: COORD. AREA" /></div>
                <div><Label className="text-xs">Nome canônico (regra)</Label><Input value={form.canonicalName} onChange={(e) => setForm({ ...form, canonicalName: e.target.value })} placeholder="Ex.: Coordenador de Área" /></div>
                <div className="flex items-end">
                  <Button className="w-full" size="sm" onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.sourceValue.trim()}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
                </div>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {groups.map((g) => (
                <div key={g.kind}>
                  <h5 className="mb-1 text-xs font-medium text-muted-foreground">{g.label}</h5>
                  <div className="space-y-1">
                    {aliases.filter((a) => a.kind === g.kind).length === 0 && <p className="text-xs text-muted-foreground">Nenhum de-para.</p>}
                    {aliases.filter((a) => a.kind === g.kind).map((a) => (
                      <div key={a.id} className="flex items-center gap-2 rounded border border-border/60 px-2 py-1 text-xs">
                        <span className="font-mono">{a.sourceValue}</span>
                        <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                        <span>{a.canonicalName ?? a.normalizedKey}</span>
                        {!a.active && <Badge variant="outline" className="ml-auto text-[10px]">inativo</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
