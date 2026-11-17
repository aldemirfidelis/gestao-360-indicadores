'use client';

import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from './ui';

export interface SignatureInput {
  password: string;
  comment: string;
  publishNow: boolean;
  publishAt: string | null;
}

export interface SignatureRequest {
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Comentário obrigatório (pedir ajustes, reprovar). */
  commentRequired?: boolean;
  commentLabel?: string;
  commentPlaceholder?: string;
  /** Aprovador final que também pode publicar na mesma assinatura. */
  allowPublishNow?: boolean;
  /** Publicação: permite agendar data e hora. */
  allowSchedule?: boolean;
  onConfirm: (input: SignatureInput) => Promise<unknown>;
}

/** Valor mínimo (hora local) para um campo datetime-local. */
function localInputMin(minutesAhead: number) {
  const date = new Date(Date.now() + minutesAhead * 60_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Assinatura eletrônica das decisões do GED: a pessoa confirma com a própria
 * senha e o sistema registra data/hora, IP e o hash do conteúdo da revisão.
 */
export function SignatureDialog({ request, onClose }: { request: SignatureRequest | null; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [comment, setComment] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [schedule, setSchedule] = useState(false);
  const [publishAt, setPublishAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setPassword('');
    setComment('');
    setPublishNow(true);
    setSchedule(false);
    setPublishAt('');
    setError(null);
    setBusy(false);
  }, [request]);

  if (!request) return null;
  const commentMissing = Boolean(request.commentRequired && !comment.trim());
  const scheduleMissing = schedule && !publishAt;
  const canConfirm = password.length > 0 && !commentMissing && !scheduleMissing && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await request.onConfirm({
        password,
        comment: comment.trim(),
        publishNow: Boolean(request.allowPublishNow && publishNow),
        publishAt: request.allowSchedule && schedule && publishAt ? new Date(publishAt).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível registrar a assinatura.'));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-status-green" />
            {request.title}
          </DialogTitle>
          {request.description && <DialogDescription>{request.description}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="g360-doc-comment">
              {request.commentLabel ?? 'Comentário'}
              {request.commentRequired ? <span className="ml-0.5 text-status-red">*</span> : <span className="text-muted-foreground"> (opcional)</span>}
            </Label>
            <Textarea
              id="g360-doc-comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={request.commentPlaceholder ?? (request.commentRequired ? 'Explique o que precisa mudar.' : 'Observação para o histórico.')}
            />
          </div>

          {request.allowPublishNow && (
            <label className="flex items-start gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} />
              <span>
                Publicar logo após a minha aprovação
                <span className="block text-xs text-muted-foreground">Se você for a última aprovação, o documento já entra em vigor com o PDF oficial.</span>
              </span>
            </label>
          )}

          {request.allowSchedule && (
            <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={schedule} onChange={(event) => setSchedule(event.target.checked)} />
                Agendar a entrada em vigor
              </label>
              {schedule && (
                <Input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} min={localInputMin(5)} />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="g360-doc-password" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              Sua senha de acesso
            </Label>
            <Input
              id="g360-doc-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              A senha confirma que foi você. Ficam registrados data e hora, endereço de rede e a impressão digital (hash) do conteúdo desta revisão.
            </p>
          </div>

          {error && <p className="rounded-md border border-status-red/30 bg-status-red/5 px-3 py-2 text-sm text-status-red">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant={request.destructive ? 'destructive' : 'default'} disabled={!canConfirm}>
              {busy ? 'Assinando…' : request.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
