'use client';

import { useEffect, useState } from 'react';
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
import type { OrgNodeRef, RuleGroup } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annexVersionId: string;
  group?: RuleGroup | null;
  onSaved: () => void;
}

const empty = { name: '', areaRefs: [] as string[], positionRefs: [] as string[], salaryPercent: '', notes: '' };

export function CombinationDialog({ open, onOpenChange, annexVersionId, group, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [cargoInput, setCargoInput] = useState('');
  const [areaPick, setAreaPick] = useState('');

  useEffect(() => {
    if (!open) return;
    if (group) {
      setForm({
        name: group.name,
        areaRefs: [...group.areaRefs],
        positionRefs: [...group.positionRefs],
        salaryPercent: group.salaryPercent ?? '',
        notes: group.notes ?? '',
      });
    } else {
      setForm(empty);
    }
    setCargoInput('');
    setAreaPick('');
  }, [open, group]);

  const { data: orgNodes = [] } = useQuery({
    queryKey: ['orgnodes'],
    queryFn: () => api<OrgNodeRef[]>('/orgnodes'),
    enabled: open,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        annexVersionId,
        name: form.name.trim(),
        areaRefs: form.areaRefs,
        positionRefs: form.positionRefs,
        salaryPercent: Number(form.salaryPercent),
        notes: form.notes.trim() || null,
      };
      return group
        ? api(`/prize/rules/groups/${group.id}`, { method: 'PATCH', json: payload })
        : api('/prize/rules/groups', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(group ? 'Combinação atualizada' : 'Combinação criada');
      onSaved();
      onOpenChange(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function addArea() {
    const name = areaPick.trim();
    if (!name) return;
    if (!form.areaRefs.includes(name)) setForm((f) => ({ ...f, areaRefs: [...f.areaRefs, name] }));
    setAreaPick('');
  }
  function addCargo() {
    const name = cargoInput.trim();
    if (!name) return;
    if (!form.positionRefs.includes(name)) setForm((f) => ({ ...f, positionRefs: [...f.positionRefs, name] }));
    setCargoInput('');
  }
  const removeArea = (name: string) => setForm((f) => ({ ...f, areaRefs: f.areaRefs.filter((a) => a !== name) }));
  const removeCargo = (name: string) => setForm((f) => ({ ...f, positionRefs: f.positionRefs.filter((c) => c !== name) }));

  const valid = form.name.trim() && form.areaRefs.length > 0 && form.positionRefs.length > 0 && form.salaryPercent !== '' && !Number.isNaN(Number(form.salaryPercent));

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

          {/* Áreas */}
          <div>
            <Label>Áreas *</Label>
            <div className="flex gap-2">
              <NativeSelect value={areaPick} onChange={(e) => setAreaPick(e.target.value)} className="flex-1">
                <option value="">Selecione uma área…</option>
                {orgNodes.map((o) => <option key={o.id} value={o.name}>{o.name}{o.type ? ` (${o.type})` : ''}</option>)}
              </NativeSelect>
              <Button type="button" variant="outline" size="sm" onClick={addArea} disabled={!areaPick}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {form.areaRefs.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma área. Adicione ao menos uma.</span>}
              {form.areaRefs.map((a) => (
                <Badge key={a} variant="secondary" className="gap-1">{a}<button type="button" onClick={() => removeArea(a)} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>
              ))}
            </div>
          </div>

          {/* Cargos */}
          <div>
            <Label>Cargos * (a mesma combinação pode ter vários cargos)</Label>
            <div className="flex gap-2">
              <Input
                value={cargoInput}
                onChange={(e) => setCargoInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCargo(); } }}
                placeholder="Ex.: Coordenador de Área"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCargo} disabled={!cargoInput.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {form.positionRefs.length === 0 && <span className="text-xs text-muted-foreground">Nenhum cargo. Adicione ao menos um.</span>}
              {form.positionRefs.map((c) => (
                <Badge key={c} variant="outline" className="gap-1">{c}<button type="button" onClick={() => removeCargo(c)} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada cargo vira uma chave de elegibilidade (área × cargo) usada para casar o colaborador na apuração.
            </p>
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
