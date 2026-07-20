'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface EmailTemplate {
  event: string;
  label: string;
  placeholders: string[];
  subject: string;
  bodyText: string;
  active: boolean;
  isCustom: boolean;
  updatedAt: string | null;
}

export default function RecruitmentCommunicationPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['recruit:manage']);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; bodyText: string; active: boolean }>>({});

  const listQuery = useQuery<EmailTemplate[]>({
    queryKey: ['recruit-email-templates'],
    queryFn: () => api('/recruitment/email-templates'),
    enabled: canManage,
  });

  // Sincroniza os rascunhos locais quando os dados chegam (sem sobrescrever edição em andamento).
  useEffect(() => {
    if (!listQuery.data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const tpl of listQuery.data ?? []) {
        if (!next[tpl.event]) next[tpl.event] = { subject: tpl.subject, bodyText: tpl.bodyText, active: tpl.active };
      }
      return next;
    });
  }, [listQuery.data]);

  const save = useMutation({
    mutationFn: ({ event, body }: { event: string; body: { subject: string; bodyText: string; active: boolean } }) =>
      api(`/recruitment/email-templates/${event}`, { method: 'POST', json: body }),
    onSuccess: () => { toast.success('Template salvo.'); void qc.invalidateQueries({ queryKey: ['recruit-email-templates'] }); },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar template.'),
  });

  const reset = useMutation({
    mutationFn: (event: string) => api(`/recruitment/email-templates/${event}/reset`, { method: 'POST' }),
    onSuccess: (_, event) => {
      toast.success('Restaurado ao padrão.');
      setDrafts((prev) => { const next = { ...prev }; delete next[event]; return next; });
      void qc.invalidateQueries({ queryKey: ['recruit-email-templates'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao restaurar template.'),
  });

  const templates = listQuery.data ?? [];

  if (!canManage) {
    return (
      <div className="space-y-4">
        <PageHeader title="Comunicação com o candidato" description="Modelos de e-mail automático por evento do funil." />
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Você não tem permissão para configurar a comunicação do recrutamento.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Comunicação com o candidato"
        description="E-mails automáticos disparados em cada evento do funil. Sem edição, usamos um texto padrão — desligue o que não fizer sentido para o seu processo."
      />

      <div className="space-y-3">
        {templates.map((tpl) => {
          const draft = drafts[tpl.event] ?? { subject: tpl.subject, bodyText: tpl.bodyText, active: tpl.active };
          const isOpen = expanded === tpl.event;
          const dirty = draft.subject !== tpl.subject || draft.bodyText !== tpl.bodyText || draft.active !== tpl.active;
          return (
            <Card key={tpl.event}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : tpl.event)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{tpl.label}</span>
                    {tpl.isCustom && <Badge variant="outline" className="text-[10px]">Personalizado</Badge>}
                    {!draft.active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Desligado</Badge>}
                  </button>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      disabled={save.isPending}
                      onChange={(e) => {
                        const active = e.target.checked;
                        setDrafts((prev) => ({ ...prev, [tpl.event]: { ...draft, active } }));
                        save.mutate({ event: tpl.event, body: { ...draft, active } });
                      }}
                    />
                    Enviar automaticamente
                  </label>
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <p className="text-[11px] text-muted-foreground">
                      Placeholders disponíveis: {tpl.placeholders.map((p) => `{{${p}}}`).join(', ')}
                    </p>
                    <div>
                      <Label className="text-xs">Assunto</Label>
                      <Input
                        value={draft.subject}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [tpl.event]: { ...draft, subject: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Corpo do e-mail</Label>
                      <Textarea
                        rows={7}
                        value={draft.bodyText}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [tpl.event]: { ...draft, bodyText: e.target.value } }))}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={!dirty || save.isPending}
                        onClick={() => save.mutate({ event: tpl.event, body: draft })}
                      >
                        <Save className="mr-2 h-3.5 w-3.5" /> Salvar
                      </Button>
                      {tpl.isCustom && (
                        <Button size="sm" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate(tpl.event)}>
                          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restaurar padrão
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
