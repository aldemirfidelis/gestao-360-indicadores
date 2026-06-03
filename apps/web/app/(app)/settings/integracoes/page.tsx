'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeftRight, Ban, Copy, KeyRound, Pencil, Plus, RefreshCcw, ScrollText, TestTube2, Trash2, Upload, Download } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

type Tab = 'connectors' | 'keys';

const PROVIDERS = [
  { value: 'REST_GENERIC', label: 'REST genérico' },
  { value: 'SAP', label: 'SAP' },
  { value: 'APDATA', label: 'Apdata' },
  { value: 'SESUITE', label: 'SE Suite' },
  { value: 'WEBHOOK', label: 'Webhook' },
];
const DIRECTIONS = [
  { value: 'OUTBOUND', label: 'Saída (enviamos)' },
  { value: 'INBOUND', label: 'Entrada (recebem)' },
  { value: 'BOTH', label: 'Ambos' },
];
const AUTH_TYPES = [
  { value: 'API_KEY', label: 'API Key (header)' },
  { value: 'BEARER', label: 'Bearer token' },
  { value: 'BASIC', label: 'Basic (usuário/senha)' },
  { value: 'OAUTH2', label: 'OAuth2' },
  { value: 'NONE', label: 'Sem autenticação' },
];
const SCOPES = [
  { value: 'indicators:read', label: 'Ler indicadores' },
  { value: 'results:read', label: 'Ler resultados' },
  { value: 'results:write', label: 'Gravar resultados' },
];

interface Connector {
  id: string;
  name: string;
  provider: string;
  direction: string;
  authType: string;
  baseUrl: string | null;
  status: string;
  hasCredentials: boolean;
  config: Record<string, unknown>;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
}
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
interface LogRow {
  id: string;
  operation: string;
  status: string;
  httpStatus: number | null;
  message: string | null;
  latencyMs: number | null;
  createdAt: string;
}

const labelOf = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;

export default function IntegracoesExternasPage() {
  const [tab, setTab] = useState<Tab>('connectors');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configurações"
        tone="admin"
        title="APIs Externas"
        description="Conecte SAP, Apdata, SE Suite e qualquer sistema externo — saída (conectores) e entrada (chaves de API). Credenciais ficam cifradas e nunca são exibidas."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações', href: '/settings' }, { label: 'APIs Externas' }]}
      />

      <div className="inline-flex rounded-md border bg-card/60 p-0.5">
        {([['connectors', 'Conectores', ArrowLeftRight], ['keys', 'Chaves de API', KeyRound]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              tab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'connectors' ? <ConnectorsTab /> : <ApiKeysTab />}
    </div>
  );
}

function ConnectorsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Connector | null>(null);
  const [creating, setCreating] = useState(false);
  const [logsFor, setLogsFor] = useState<Connector | null>(null);

  const query = useQuery<Connector[]>({ queryKey: ['ext-connectors'], queryFn: () => api('/integrations/external') });
  const rows = query.data ?? [];

  const test = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; message?: string }>(`/integrations/external/${id}/test`, { method: 'POST' }),
    onSuccess: (r) => { toast[r.ok ? 'success' : 'error'](r.ok ? 'Conexão OK' : `Falhou: ${r.message ?? ''}`); qc.invalidateQueries({ queryKey: ['ext-connectors'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha no teste'),
  });
  const run = useMutation({
    mutationFn: ({ id, operation }: { id: string; operation: string }) => api<{ ok: boolean; message?: string }>(`/integrations/external/${id}/run`, { method: 'POST', json: { operation } }),
    onSuccess: (r) => { toast[r.ok ? 'success' : 'error'](r.ok ? 'Sincronização concluída' : `Falhou: ${r.message ?? ''}`); qc.invalidateQueries({ queryKey: ['ext-connectors'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao sincronizar'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/integrations/external/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Conector removido'); qc.invalidateQueries({ queryKey: ['ext-connectors'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover'),
  });

  return (
    <SectionCard
      title="Conectores"
      description="Sistemas externos integrados a esta empresa. A sincronização de saída é manual (sob demanda)."
      actions={<Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Novo conector</Button>}
      contentClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="table-modern">
          <thead>
            <tr>
              <th className="text-left">Conector</th>
              <th className="text-left">Tipo / Direção</th>
              <th className="text-left">Status</th>
              <th className="text-left">Última execução</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Carregando...</td></tr>}
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.baseUrl ?? 'sem baseUrl'}{c.hasCredentials ? ' · credenciais ✓' : ' · sem credenciais'}</div>
                </td>
                <td className="text-sm">{labelOf(PROVIDERS, c.provider)}<div className="text-xs text-muted-foreground">{labelOf(DIRECTIONS, c.direction)}</div></td>
                <td>
                  <Badge className={cn('text-[10px]', c.status === 'enabled' ? 'bg-emerald-500/10 text-emerald-600 border-transparent' : 'bg-muted text-muted-foreground border-transparent')}>
                    {c.status === 'enabled' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="text-xs text-muted-foreground">
                  {c.lastRunAt ? (
                    <span className={cn(c.lastStatus === 'ERROR' && 'text-rose-600')}>
                      {formatDate(c.lastRunAt)} · {c.lastStatus ?? '-'}{c.lastLatencyMs != null ? ` · ${c.lastLatencyMs}ms` : ''}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-8" title="Testar conexão" onClick={() => test.mutate(c.id)} disabled={test.isPending}>
                      <TestTube2 className="h-3.5 w-3.5" />
                    </Button>
                    {c.direction !== 'INBOUND' && (
                      <>
                        <Button size="sm" variant="outline" className="h-8" title="Enviar resultados" onClick={() => run.mutate({ id: c.id, operation: 'push:results' })} disabled={run.isPending}>
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" title="Puxar resultados" onClick={() => run.mutate({ id: c.id, operation: 'pull:results' })} disabled={run.isPending}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-8" title="Logs" onClick={() => setLogsFor(c)}><ScrollText className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8" title="Editar" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 text-destructive" title="Remover" onClick={() => { if (window.confirm('Remover este conector?')) remove.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {!query.isLoading && rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nenhum conector cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ConnectorDialog
          connector={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ['ext-connectors'] }); }}
        />
      )}
      {logsFor && <LogsDialog connector={logsFor} onClose={() => setLogsFor(null)} />}
    </SectionCard>
  );
}

function ConnectorDialog({ connector, onClose, onSaved }: { connector: Connector | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!connector;
  const [form, setForm] = useState({
    name: connector?.name ?? '',
    provider: connector?.provider ?? 'REST_GENERIC',
    direction: connector?.direction ?? 'OUTBOUND',
    authType: connector?.authType ?? 'API_KEY',
    baseUrl: connector?.baseUrl ?? '',
    enabled: connector ? connector.status === 'enabled' : true,
    apiKey: '', apiKeyHeader: '', bearerToken: '', username: '', password: '',
    config: connector?.config ? JSON.stringify(connector.config, null, 2) : '',
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      let config: Record<string, unknown> | undefined;
      if (form.config.trim()) {
        try { config = JSON.parse(form.config); } catch { throw new Error('Config (JSON) inválido.'); }
      }
      const credentials: Record<string, unknown> = {};
      if (form.authType === 'API_KEY' && form.apiKey) { credentials.apiKey = form.apiKey; if (form.apiKeyHeader) credentials.apiKeyHeader = form.apiKeyHeader; }
      if (form.authType === 'BEARER' && form.bearerToken) credentials.bearerToken = form.bearerToken;
      if (form.authType === 'BASIC' && (form.username || form.password)) { credentials.username = form.username; credentials.password = form.password; }
      const payload: any = {
        name: form.name.trim(), direction: form.direction, authType: form.authType,
        baseUrl: form.baseUrl || undefined, enabled: form.enabled, config,
      };
      if (Object.keys(credentials).length) payload.credentials = credentials;
      if (!isEdit) payload.provider = form.provider;
      return isEdit
        ? api(`/integrations/external/${connector!.id}`, { method: 'PATCH', json: payload })
        : api('/integrations/external', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success(isEdit ? 'Conector atualizado' : 'Conector criado'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar conector' : 'Novo conector'}</DialogTitle></DialogHeader>
        <div className="grid max-h-[64vh] grid-cols-1 gap-3 overflow-y-auto py-1 sm:grid-cols-2">
          <Field label="Nome *" className="sm:col-span-2"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Sistema">
            <NativeSelect value={form.provider} onChange={(e) => set('provider', e.target.value)} disabled={isEdit}>
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Direção">
            <NativeSelect value={form.direction} onChange={(e) => set('direction', e.target.value)}>
              {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="URL base" className="sm:col-span-2"><Input value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="https://api.fornecedor.com/v1" /></Field>
          <Field label="Autenticação">
            <NativeSelect value={form.authType} onChange={(e) => set('authType', e.target.value)}>
              {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Ativo">
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} className="h-4 w-4 accent-foreground" /> Conector ativo
            </label>
          </Field>

          {form.authType === 'API_KEY' && (<>
            <Field label="API Key"><Input type="password" value={form.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder={isEdit ? '•••• (mantém atual)' : ''} /></Field>
            <Field label="Header da API Key"><Input value={form.apiKeyHeader} onChange={(e) => set('apiKeyHeader', e.target.value)} placeholder="X-Api-Key" /></Field>
          </>)}
          {form.authType === 'BEARER' && (
            <Field label="Bearer token" className="sm:col-span-2"><Input type="password" value={form.bearerToken} onChange={(e) => set('bearerToken', e.target.value)} placeholder={isEdit ? '•••• (mantém atual)' : ''} /></Field>
          )}
          {form.authType === 'BASIC' && (<>
            <Field label="Usuário"><Input value={form.username} onChange={(e) => set('username', e.target.value)} /></Field>
            <Field label="Senha"><Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={isEdit ? '•••• (mantém atual)' : ''} /></Field>
          </>)}

          <Field label="Config avançada (JSON: endpoints, headers, mapeamento)" className="sm:col-span-2">
            <textarea value={form.config} onChange={(e) => set('config', e.target.value)} rows={5} className="w-full rounded-md border border-border/60 bg-background p-2 font-mono text-xs" placeholder='{"endpoints":{"test":"/health","push:results":"/results"}}' />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', save.isPending && 'animate-spin')} />
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogsDialog({ connector, onClose }: { connector: Connector; onClose: () => void }) {
  const query = useQuery<LogRow[]>({ queryKey: ['ext-logs', connector.id], queryFn: () => api(`/integrations/external/${connector.id}/logs`) });
  const rows = query.data ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Logs — {connector.name}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {query.isLoading && <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>}
          {rows.map((l) => (
            <div key={l.id} className="rounded-md border p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{l.operation}</span>
                <Badge className={cn('text-[10px]', l.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600 border-transparent' : 'bg-rose-500/10 text-rose-600 border-transparent')}>{l.status}</Badge>
              </div>
              <div className="mt-1 text-muted-foreground">{formatDate(l.createdAt)}{l.httpStatus ? ` · HTTP ${l.httpStatus}` : ''}{l.latencyMs != null ? ` · ${l.latencyMs}ms` : ''}</div>
              {l.message && <div className="mt-1 break-words text-muted-foreground">{l.message}</div>}
            </div>
          ))}
          {!query.isLoading && rows.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Sem execuções ainda.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeysTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);

  const query = useQuery<ApiKey[]>({ queryKey: ['ext-keys'], queryFn: () => api('/integrations/external/keys') });
  const rows = query.data ?? [];

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/integrations/external/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Chave revogada'); qc.invalidateQueries({ queryKey: ['ext-keys'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao revogar'),
  });

  return (
    <SectionCard
      title="Chaves de API (entrada)"
      description="Sistemas externos usam estas chaves no header X-Api-Key para enviar/ler dados desta empresa. A chave é exibida apenas uma vez."
      actions={<Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nova chave</Button>}
      contentClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="table-modern">
          <thead>
            <tr>
              <th className="text-left">Nome</th>
              <th className="text-left">Prefixo</th>
              <th className="text-left">Escopos</th>
              <th className="text-left">Status</th>
              <th className="text-left">Último uso</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Carregando...</td></tr>}
            {rows.map((k) => (
              <tr key={k.id}>
                <td className="font-medium">{k.name}</td>
                <td className="font-mono text-xs">{k.keyPrefix}…</td>
                <td className="text-xs">{k.scopes.join(', ')}</td>
                <td><Badge className={cn('text-[10px]', k.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-transparent' : 'bg-muted text-muted-foreground border-transparent')}>{k.status === 'active' ? 'Ativa' : 'Revogada'}</Badge></td>
                <td className="text-xs text-muted-foreground">{k.lastUsedAt ? formatDate(k.lastUsedAt) : '—'}</td>
                <td className="text-right">
                  {k.status === 'active' && (
                    <Button size="sm" variant="ghost" className="h-8 text-destructive" title="Revogar" onClick={() => { if (window.confirm('Revogar esta chave? Sistemas que a usam perderão o acesso.')) revoke.mutate(k.id); }}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!query.isLoading && rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Nenhuma chave criada.</td></tr>}
          </tbody>
        </table>
      </div>

      {creating && <ApiKeyDialog onClose={() => setCreating(false)} onCreated={(name, token) => { setCreating(false); setNewToken({ name, token }); qc.invalidateQueries({ queryKey: ['ext-keys'] }); }} />}
      {newToken && <TokenDialog name={newToken.name} token={newToken.token} onClose={() => setNewToken(null)} />}
    </SectionCard>
  );
}

function ApiKeyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string, token: string) => void }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['results:write']);
  const create = useMutation({
    mutationFn: () => api<{ token: string; name: string }>('/integrations/external/keys', { method: 'POST', json: { name: name.trim(), scopes } }),
    onSuccess: (r) => onCreated(r.name, r.token),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar chave'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova chave de API</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Nome *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Integração SAP - Produção" /></Field>
          <div>
            <Label>Escopos</Label>
            <div className="mt-1 space-y-1.5">
              {SCOPES.map((s) => (
                <label key={s.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                  <input type="checkbox" checked={scopes.includes(s.value)} onChange={(e) => setScopes((prev) => e.target.checked ? [...prev, s.value] : prev.filter((x) => x !== s.value))} className="h-4 w-4 accent-foreground" />
                  <span>{s.label} <span className="font-mono text-xs text-muted-foreground">{s.value}</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || scopes.length === 0 || create.isPending}>Criar chave</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TokenDialog({ name, token, onClose }: { name: string; token: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Chave criada: {name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Copie a chave agora — ela <strong>não será exibida novamente</strong>. Use no header <code className="font-mono">X-Api-Key</code>.</p>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs">{token}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(token); toast.success('Copiada'); }}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Concluído</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
