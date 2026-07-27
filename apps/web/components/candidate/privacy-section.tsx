'use client';

import { ShieldCheck } from 'lucide-react';
import { DATA_REQUEST_STATUS, DATA_REQUEST_TYPE, status, text } from '@/lib/candidate/labels';
import type { DataRequest } from '@/lib/candidate/types';
import { Button, Card, CardTitle, EmptyState, Pill, Select, TextArea, formatDate } from './ui';

const REQUEST_HELP: Record<string, string> = {
  ACCESS: 'Receber a relação dos dados que a empresa tem sobre você.',
  RECTIFICATION: 'Corrigir uma informação errada ou desatualizada.',
  PORTABILITY: 'Receber seus dados em formato que possa levar para outro lugar.',
  DELETION: 'Pedir a exclusão ou anonimização dos seus dados.',
};

/** Direitos do titular (LGPD): abrir pedido e acompanhar o andamento. */
export function PrivacySection({
  dataRequests,
  form,
  busy,
  onFormChange,
  onSubmit,
}: {
  dataRequests: DataRequest[];
  form: { type: string; details: string };
  busy: boolean;
  onFormChange: (patch: Partial<{ type: string; details: string }>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-sky-500" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Seus direitos sobre seus dados</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Pela LGPD, você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados. O pedido fica registrado e é atendido
              pela empresa responsável pelo processo seletivo.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle title="Abrir uma solicitação" />
        <div className="space-y-4">
          <Select label="O que você precisa" value={form.type} onChange={(type) => onFormChange({ type })}>
            <option value="ACCESS">Acesso aos dados</option>
            <option value="RECTIFICATION">Retificação</option>
            <option value="PORTABILITY">Portabilidade</option>
            <option value="DELETION">Exclusão/anonimização</option>
          </Select>
          <p className="text-sm text-slate-500 dark:text-slate-400">{REQUEST_HELP[form.type] ?? ''}</p>
          <TextArea
            label="Detalhes (opcional)"
            rows={3}
            value={form.details}
            onChange={(details) => onFormChange({ details })}
            placeholder="Explique o que precisa, se ajudar a empresa a atender mais rápido."
          />
          <Button onClick={onSubmit} disabled={busy}>Abrir solicitação</Button>
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle title="Solicitações abertas" />
        </div>
        {dataRequests.length === 0 ? (
          <div className="p-5 pt-0 sm:p-6 sm:pt-0">
            <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="Nenhuma solicitação" description="Quando você abrir um pedido, o andamento aparece aqui." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {dataRequests.map((item) => {
              const badge = status(DATA_REQUEST_STATUS, item.status);
              return (
                <li key={item.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{text(DATA_REQUEST_TYPE, item.type)}</span>
                    <Pill label={badge.label} tone={badge.tone} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Aberta em {formatDate(item.requestedAt)}
                    {item.resolvedAt ? ` · atendida em ${formatDate(item.resolvedAt)}` : ''}
                  </p>
                  {item.details && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.details}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
