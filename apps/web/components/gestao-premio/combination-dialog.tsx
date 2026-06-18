'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import type { CatalogRef, RuleGroup } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annexVersionId: string;
  group?: RuleGroup | null;
  onSaved: () => void;
}

const empty = { name: '', salaryPercent: '', notes: '' };

export function CombinationDialog({ open, onOpenChange, annexVersionId, group, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [cargoIds, setCargoIds] = useState<string[]>([]);
  const [newAreas, setNewAreas] = useState<string[]>([]);
  const [newCargos, setNewCargos] = useState<string[]>([]);
  const [areaPick, setAreaPick] = useState('');
  const [cargoPick, setCargoPick] = useState('');
  const [newAreaInput, setNewAreaInput] = useState('');
  const [newCargoInput, setNewCargoInput] = useState('');

  const { data: areas = [] } = useQuery({ queryKey: ['prize-catalog-areas'], queryFn: () => api<CatalogRef[]>('/prize/catalog/areas'), enabled: open, staleTime: 30_000 });
  const { data: cargos = [] } = useQuery({ queryKey: ['prize-catalog-cargos'], queryFn: () => api<CatalogRef[]>('/prize/catalog/cargos'), enabled: open, staleTime: 30_000 });

  useEffect(() => {
    if (!open) return;
    setForm(group ? { name: group.name, salaryPercent: group.salaryPercent ?? '', notes: group.notes ?? '' } : empty);
    setAreaIds(group ? [...group.areaRefIds] : []);
    setCargoIds(group ? [...group.cargoRefIds] : []);
    setNewAreas([]); setNewCargos([]); setAreaPick(''); setCargoPick(''); setNewAreaInput(''); setNewCargoInput('');
  }, [open, group]);

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const cargoById = useMemo(() => new Map(cargos.map((c) => [c.id, c])), [cargos]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        annexVersionId,
        name: form.name.trim(),
        salaryPercent: Number(form.salaryPercent),
        notes: form.notes.trim() || null,
        areaRefIds: areaIds,
        cargoRefIds: cargoIds,
        areaRefs: newAreas,       // nomes novos -> criados no catalogo pelo backend
        positionRefs: newCargos,
      };
      return group
        ? api(`/prize/rules/groups/${group.id}`, { method: 'PATCH', json: payload })
        : api('/prize/rules/groups', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success(group ? 'Combinação atualizada' : 'Combinação criada'); onSaved(); onOpenChange(false); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const addAreaId = () => { if (areaPick && !areaIds.includes(areaPick)) setAreaIds((v) => [...v, areaPick]); setAreaPick(''); };
  const addCargoId = () => { if (cargoPick && !cargoIds.includes(cargoPick)) setCargoIds((v) => [...v, cargoPick]); setCargoPick(''); };
  const addNewArea = () => { const n = newAreaInput.trim(); if (n && !newAreas.includes(n)) setNewAreas((v) => [...v, n]); setNewAreaInput(''); };
  const addNewCargo = () => { const n = newCargoInput.trim(); if (n && !newCargos.includes(n)) setNewCargos((v) => [...v, n]); setNewCargoInput(''); };

  const totalAreas = areaIds.length + newAreas.length;
  const totalCargos = cargoIds.length + newCargos.length;
  const valid = form.name.trim() && totalAreas > 0 && totalCargos > 0 && form.salaryPercent !== '' && !Number.isNaN(Number(form.salaryPercent));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{group ? 'Editar combinação' : 'Nova combinação (área × cargos)'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Nome da combinação *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Coordenadores — Estradas" />
            </div>
            <div>
              <Label>Salário Possível % *</Label>
              <Input type="number" step="0.01" value={form.salaryPercent} onChange={(e) => setForm({ ...form, salaryPercent: e.target.value })} placeholder="8,33" />
            </div>
          </div>

          {/* Áreas — do catálogo (por ID) ou nova */}
          <div>
            <Label>Áreas/Setores * (do catálogo)</Label>
            <div className="flex gap-2">
              <NativeSelect value={areaPick} onChange={(e) => setAreaPick(e.target.value)} className="flex-1">
                <option value="">Selecione do catálogo…</option>
                {areas.filter((a) => a.active && !areaIds.includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name} · #{a.code}{a.kind === 'SECTOR' ? ' (setor)' : ''}</option>)}
              </NativeSelect>
              <Button type="button" variant="outline" size="sm" onClick={addAreaId} disabled={!areaPick}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-1 flex gap-2">
              <Input value={newAreaInput} onChange={(e) => setNewAreaInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewArea(); } }} placeholder="…ou digite uma área nova (cria no catálogo)" className="h-8 text-sm" />
              <Button type="button" variant="ghost" size="sm" onClick={addNewArea} disabled={!newAreaInput.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {totalAreas === 0 && <span className="text-xs text-muted-foreground">Nenhuma área. Adicione ao menos uma.</span>}
              {areaIds.map((id) => <Badge key={id} variant="secondary" className="gap-1">{areaById.get(id)?.name ?? id}{areaById.get(id) ? ` · #${areaById.get(id)!.code}` : ''}<button type="button" onClick={() => setAreaIds((v) => v.filter((x) => x !== id))} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>)}
              {newAreas.map((n) => <Badge key={n} variant="outline" className="gap-1">{n} (nova)<button type="button" onClick={() => setNewAreas((v) => v.filter((x) => x !== n))} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>)}
            </div>
          </div>

          {/* Cargos */}
          <div>
            <Label>Cargos * (do catálogo)</Label>
            <div className="flex gap-2">
              <NativeSelect value={cargoPick} onChange={(e) => setCargoPick(e.target.value)} className="flex-1">
                <option value="">Selecione do catálogo…</option>
                {cargos.filter((c) => c.active && !cargoIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name} · #{c.code}</option>)}
              </NativeSelect>
              <Button type="button" variant="outline" size="sm" onClick={addCargoId} disabled={!cargoPick}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-1 flex gap-2">
              <Input value={newCargoInput} onChange={(e) => setNewCargoInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewCargo(); } }} placeholder="…ou digite um cargo novo (cria no catálogo)" className="h-8 text-sm" />
              <Button type="button" variant="ghost" size="sm" onClick={addNewCargo} disabled={!newCargoInput.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {totalCargos === 0 && <span className="text-xs text-muted-foreground">Nenhum cargo. Adicione ao menos um.</span>}
              {cargoIds.map((id) => <Badge key={id} variant="secondary" className="gap-1">{cargoById.get(id)?.name ?? id}{cargoById.get(id) ? ` · #${cargoById.get(id)!.code}` : ''}<button type="button" onClick={() => setCargoIds((v) => v.filter((x) => x !== id))} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>)}
              {newCargos.map((n) => <Badge key={n} variant="outline" className="gap-1">{n} (novo)<button type="button" onClick={() => setNewCargos((v) => v.filter((x) => x !== n))} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">O cargo/área (por ID) é a chave de elegibilidade: o colaborador casa com a combinação pelo mesmo ID do catálogo.</p>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>{save.isPending ? 'Salvando…' : group ? 'Salvar' : 'Criar combinação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
