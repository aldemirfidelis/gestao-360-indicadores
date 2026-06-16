'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Save } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';

interface SettingsResponse {
  defaults: {
    protectedTables: string[];
    limits: { maxRows: number; defaultPageSize: number; maxPageSize: number; safeStatementTimeoutMs: number; advancedStatementTimeoutMs: number; maxSnapshotRows: number };
  };
  settings: { id: string; key: string; value: string; updatedAt: string }[];
}

export default function AdvancedSettingsPage() {
  const qc = useQueryClient();
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const data = useQuery<SettingsResponse>({ queryKey: ['db-admin', 'settings'], queryFn: () => api('/admin/database/settings'), refetchOnWindowFocus: false });

  const save = useMutation({
    mutationFn: () => api('/admin/database/settings', { method: 'PUT', json: { key, value } }),
    onSuccess: () => { toast.success('Configuração salva.'); setKey(''); setValue(''); qc.invalidateQueries({ queryKey: ['db-admin', 'settings'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const d = data.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configurações Avançadas</h2>
        <p className="text-sm text-muted-foreground">Limites, proteções e parâmetros do módulo (persistidos em AppSetting, auditados).</p>
      </div>

      {data.isLoading && <LoadingState label="Lendo configurações..." />}

      {d && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard title="Tabelas protegidas" description="Bloqueio adicional para ações destrutivas.">
              <div className="flex flex-wrap gap-1.5">
                {d.defaults.protectedTables.map((t) => (
                  <Badge key={t} variant="outline" className="gap-1 border-status-red/40 text-status-red"><Lock className="h-3 w-3" />{t}</Badge>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Limites de execução" description="Padrões aplicados às operações.">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Item k="Máx. linhas (leitura/SQL)" v={d.defaults.limits.maxRows} />
                <Item k="Página padrão" v={d.defaults.limits.defaultPageSize} />
                <Item k="Página máx." v={d.defaults.limits.maxPageSize} />
                <Item k="Timeout seguro (ms)" v={d.defaults.limits.safeStatementTimeoutMs} />
                <Item k="Timeout avançado (ms)" v={d.defaults.limits.advancedStatementTimeoutMs} />
                <Item k="Máx. linhas do retrato" v={d.defaults.limits.maxSnapshotRows} />
              </dl>
            </SectionCard>
          </div>

          <SectionCard title="Parâmetros persistidos" description="Chave/valor sob o grupo database-admin.">
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <div className="min-w-[220px]"><Label>Chave</Label><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ex.: dbadmin.defaultMode" /></div>
              <div className="min-w-[220px] flex-1"><Label>Valor</Label><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex.: safe" /></div>
              <Button onClick={() => save.mutate()} disabled={!key || save.isPending}><Save className="mr-2 h-4 w-4" /> Salvar</Button>
            </div>
            {d.settings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum parâmetro personalizado. Os padrões acima estão em vigor.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead><tr><th className="text-left">Chave</th><th className="text-left">Valor</th><th className="text-left">Atualizado</th></tr></thead>
                  <tbody>
                    {d.settings.map((s) => (
                      <tr key={s.id}>
                        <td className="font-mono text-xs">{s.key}</td>
                        <td className="font-mono text-xs">{s.value}</td>
                        <td className="text-xs text-muted-foreground">{new Date(s.updatedAt).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

function Item({ k, v }: { k: string; v: number }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-mono">{v.toLocaleString('pt-BR')}</dd>
    </>
  );
}
