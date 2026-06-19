'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import type { CatalogIndicator, PlatformIndicatorRef } from './types';
import { DIRECTION_PT } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  catalog: CatalogIndicator[];
  onSaved: () => void;
  onCatalogChanged: () => void;
}

export function LinkIndicatorDialog({ open, onOpenChange, groupId, catalog, onSaved, onCatalogChanged }: Props) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [manual, setManual] = useState(false);
  const [catalogId, setCatalogId] = useState('');
  const [platformIndicatorId, setPlatformIndicatorId] = useState('');
  const [newInd, setNewInd] = useState({ name: '', unit: '', direction: 'HIGHER_BETTER' });
  const [link, setLink] = useState({ weight: '', type: 'VARIABLE', validityKind: 'CALENDAR_YEAR', startMonth: 1, monthsCount: 12 });

  useEffect(() => {
    if (!open) return;
    setMode(catalog.length ? 'existing' : 'new');
    setManual(false);
    setCatalogId('');
    setPlatformIndicatorId('');
    setNewInd({ name: '', unit: '', direction: 'HIGHER_BETTER' });
    setLink({ weight: '', type: 'VARIABLE', validityKind: 'CALENDAR_YEAR', startMonth: 1, monthsCount: 12 });
  }, [open, catalog.length]);

  const { data: platformOptions = [] } = useQuery({
    queryKey: ['platform-indicators-ref'],
    queryFn: () => api<PlatformIndicatorRef[]>('/prize/indicators/platform-options'),
    enabled: open && mode === 'new' && !manual,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async () => {
      let targetCatalogId = catalogId;
      if (mode === 'new') {
        let body: Record<string, unknown>;
        if (manual) {
          body = { name: newInd.name.trim(), unit: newInd.unit.trim() || null, direction: newInd.direction, source: 'MANUAL' };
        } else {
          const pi = platformOptions.find((p) => p.id === platformIndicatorId);
          if (!pi) throw new Error('Selecione o indicador da plataforma');
          body = { name: pi.name, unit: pi.unit ?? null, direction: pi.direction, platformIndicatorId: pi.id, source: 'INTERNAL_API' };
        }
        const created = await api<CatalogIndicator>('/prize/rules/catalog', { method: 'POST', json: body });
        targetCatalogId = created.id;
        onCatalogChanged();
      }
      return api(`/prize/rules/groups/${groupId}/indicators`, {
        method: 'POST',
        json: {
          catalogId: targetCatalogId,
          weight: Number(link.weight),
          type: link.type,
          validityKind: link.validityKind,
          startMonth: Number(link.startMonth) || 1,
          monthsCount: Number(link.monthsCount) || 12,
        },
      });
    },
    onSuccess: () => { toast.success('Indicador vinculado à combinação'); onSaved(); onOpenChange(false); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const safra = link.validityKind === 'CROP_YEAR';
  const catalogOk = mode === 'existing' ? !!catalogId : manual ? !!newInd.name.trim() : !!platformIndicatorId;
  const valid = catalogOk && link.weight !== '' && !Number.isNaN(Number(link.weight));

  const availableCatalog = useMemo(() => catalog.filter((c) => c.active), [catalog]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Vincular indicador à combinação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => setMode('existing')} className={`rounded px-2 py-1 ${mode === 'existing' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Do catálogo</button>
            <button type="button" onClick={() => setMode('new')} className={`rounded px-2 py-1 ${mode === 'new' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Novo no catálogo</button>
          </div>

          {mode === 'existing' ? (
            <div>
              <Label>Indicador do catálogo *</Label>
              <NativeSelect value={catalogId} onChange={(e) => setCatalogId(e.target.value)}>
                <option value="">Selecione…</option>
                {availableCatalog.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </NativeSelect>
              {availableCatalog.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Catálogo vazio. Use “Novo no catálogo”.</p>}
            </div>
          ) : !manual ? (
            <div>
              <Label>Indicador da plataforma *</Label>
              <NativeSelect value={platformIndicatorId} onChange={(e) => setPlatformIndicatorId(e.target.value)}>
                <option value="">Selecione no catálogo nativo…</option>
                {platformOptions.map((pi) => <option key={pi.id} value={pi.id}>{pi.code ? `${pi.code} — ` : ''}{pi.name}</option>)}
              </NativeSelect>
              <p className="mt-1 text-xs text-muted-foreground">Reaproveita o indicador nativo (nome, unidade, sentido) e sincroniza o realizado dos Lançamentos — sem recadastro.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome *</Label><Input value={newInd.name} onChange={(e) => setNewInd({ ...newInd, name: e.target.value })} /></div>
                <div><Label>Unidade</Label><Input value={newInd.unit} onChange={(e) => setNewInd({ ...newInd, unit: e.target.value })} placeholder="%, ton…" /></div>
                <div><Label>Sentido</Label>
                  <NativeSelect value={newInd.direction} onChange={(e) => setNewInd({ ...newInd, direction: e.target.value })}>
                    {Object.entries(DIRECTION_PT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </NativeSelect>
                </div>
              </div>
            </div>
          )}

          {mode === 'new' && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
              Indicador exclusivo do prêmio (não existe no catálogo nativo; realizado manual)
            </label>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
            <div><Label>Peso % na combinação *</Label><Input type="number" step="0.01" value={link.weight} onChange={(e) => setLink({ ...link, weight: e.target.value })} placeholder="50" /></div>
            <div><Label>Tipo</Label>
              <NativeSelect value={link.type} onChange={(e) => setLink({ ...link, type: e.target.value })}>
                <option value="VARIABLE">Variável (muda mês a mês)</option>
                <option value="FIXED">Fixo (igual o ano todo)</option>
              </NativeSelect>
            </div>
            <div><Label>Vigência</Label>
              <NativeSelect value={link.validityKind} onChange={(e) => setLink({ ...link, validityKind: e.target.value })}>
                <option value="CALENDAR_YEAR">Ano civil</option>
                <option value="CROP_YEAR">Ano-safra</option>
              </NativeSelect>
            </div>
            {safra && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Mês início</Label><Input type="number" min={1} max={12} value={link.startMonth} onChange={(e) => setLink({ ...link, startMonth: Number(e.target.value) })} /></div>
                <div><Label>Qtd. meses</Label><Input type="number" min={1} max={12} value={link.monthsCount} onChange={(e) => setLink({ ...link, monthsCount: Number(e.target.value) })} /></div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>{save.isPending ? 'Vinculando…' : 'Vincular'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
