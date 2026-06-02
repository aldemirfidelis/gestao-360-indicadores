'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface DdlPlan {
  sql: string;
  risk: 'low' | 'medium' | 'high';
  warnings: string[];
  requiresConfirmationPhrase: boolean;
  confirmationPhrase: string;
}

const RISK_CLS: Record<string, string> = { low: 'pill-green', medium: 'pill-yellow', high: 'pill-red' };

/**
 * Fluxo padrão de DDL: mostra o SQL gerado + risco + avisos (preview), exige
 * a frase de confirmação para alto risco e então executa (transação + auditoria no backend).
 */
export function DdlDialog({
  title,
  operation,
  params,
  onClose,
  onDone,
}: {
  title: string;
  operation: string;
  params: Record<string, unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phrase, setPhrase] = useState('');

  const preview = useQuery<DdlPlan>({
    queryKey: ['db-admin', 'ddl-preview', operation, params],
    queryFn: () => api<DdlPlan>('/admin/database/structure/preview', { method: 'POST', json: { operation, params } }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const execute = useMutation({
    mutationFn: () => api('/admin/database/structure/execute', { method: 'POST', json: { operation, params, confirmationPhrase: phrase } }),
    onSuccess: () => {
      toast.success('Operação estrutural aplicada.');
      onDone();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const plan = preview.data;
  const canRun = plan && (!plan.requiresConfirmationPhrase || phrase === plan.confirmationPhrase);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {preview.isLoading && <div className="p-4 text-sm text-muted-foreground">Gerando SQL...</div>}
        {preview.isError && (
          <div className="rounded-lg border border-status-red/30 bg-status-red/10 p-3 text-sm">{(preview.error as ApiError)?.message}</div>
        )}

        {plan && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={cn('pill', RISK_CLS[plan.risk])}>Risco {plan.risk}</span>
            </div>
            <div>
              <Label>SQL gerado</Label>
              <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">{plan.sql}</pre>
            </div>
            {plan.warnings.length > 0 && (
              <div className="space-y-1 rounded-lg border border-status-yellow/40 bg-status-yellow/10 p-3 text-xs">
                {plan.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-yellow" />
                    {w}
                  </div>
                ))}
              </div>
            )}
            {plan.requiresConfirmationPhrase && (
              <div>
                <Label className="text-status-red">Operação de alto risco. Digite: <span className="font-mono">{plan.confirmationPhrase}</span></Label>
                <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} autoFocus />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            className={plan?.risk === 'high' ? 'bg-status-red text-white hover:bg-status-red/90' : undefined}
            disabled={!canRun || execute.isPending}
            onClick={() => execute.mutate()}
          >
            {execute.isPending ? 'Aplicando...' : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
