'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ReasonDialogState {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  /** Quando true (padrão), o confirmar exige texto não vazio. */
  required?: boolean;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (value: string) => void;
}

/**
 * Dialog padrão para justificativas/motivos em decisões de workflow
 * (substitui os window.prompt nativos apontados na auditoria de UX).
 *
 * Uso: estado `ReasonDialogState | null` no consumidor; `onClose` zera o estado.
 */
export function ReasonDialog({ state, onClose }: { state: ReasonDialogState | null; onClose: () => void }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (state) setValue('');
  }, [state]);

  if (!state) return null;
  const required = state.required ?? true;
  const canConfirm = !required || value.trim().length > 0;

  function confirm() {
    if (!state || !canConfirm) return;
    const { onConfirm } = state;
    onClose();
    onConfirm(value.trim());
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
        </DialogHeader>
        {state.description && <p className="text-sm text-muted-foreground">{state.description}</p>}
        <div>
          <Label>{state.label ?? 'Justificativa'}{required ? '' : ' (opcional)'}</Label>
          <Textarea
            autoFocus
            rows={3}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={state.placeholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) confirm();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant={state.destructive ? 'destructive' : 'default'} onClick={confirm} disabled={!canConfirm}>
            {state.confirmLabel ?? 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
