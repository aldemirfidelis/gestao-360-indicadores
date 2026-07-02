'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { GENDER_LABELS, RATING_LABELS, type FitRow } from '@/lib/compensation/types';

function toInputDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/**
 * Edicao do perfil do colaborador (dados demograficos p/ equidade salarial e
 * rating de desempenho p/ matriz de merito). Persistido em
 * CompensationEmployeeProfile via PATCH /cargos-salarios/employees/:id/profile.
 */
export function EmployeeProfileDialog({ row, onClose }: { row: FitRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    gender: row.gender ?? '',
    raceEthnicity: row.raceEthnicity ?? '',
    admissionDate: toInputDate(row.admissionDate),
    performanceRating: row.performanceRating != null ? String(row.performanceRating) : '',
    performanceCycleRef: row.performanceCycleRef ?? '',
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/cargos-salarios/employees/${row.employeeId}/profile`, {
        method: 'PATCH',
        json: {
          gender: form.gender || null,
          raceEthnicity: form.raceEthnicity || null,
          admissionDate: form.admissionDate || null,
          performanceRating: form.performanceRating ? Number(form.performanceRating) : null,
          performanceCycleRef: form.performanceCycleRef || null,
        },
      }),
    onSuccess: () => {
      toast.success('Perfil do colaborador atualizado');
      qc.invalidateQueries({ queryKey: ['compensation', 'enquadramento'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'equidade'] });
      onClose();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível salvar o perfil'),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Perfil &amp; desempenho — {row.employeeName}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Dados usados de forma agregada na análise de equidade salarial (Lei 14.611/2023) e na matriz de mérito.
          O gênero é autodeclarado; preencha conforme o cadastro oficial de RH.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Gênero</Label>
            <NativeSelect value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">Não informado</option>
              {Object.entries(GENDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Raça/Cor (autodeclarada)</Label>
            <Input value={form.raceEthnicity} onChange={(e) => setForm((f) => ({ ...f, raceEthnicity: e.target.value }))} placeholder="Opcional" />
          </div>
          <div>
            <Label>Data de admissão</Label>
            <Input type="date" value={form.admissionDate} onChange={(e) => setForm((f) => ({ ...f, admissionDate: e.target.value }))} />
          </div>
          <div>
            <Label>Rating de desempenho</Label>
            <NativeSelect value={form.performanceRating} onChange={(e) => setForm((f) => ({ ...f, performanceRating: e.target.value }))}>
              <option value="">Sem avaliação</option>
              {Object.entries(RATING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{value} — {label}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Ciclo da avaliação</Label>
            <Input value={form.performanceCycleRef} onChange={(e) => setForm((f) => ({ ...f, performanceCycleRef: e.target.value }))} placeholder="Ex.: 2026" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? 'Salvando...' : 'Salvar perfil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
