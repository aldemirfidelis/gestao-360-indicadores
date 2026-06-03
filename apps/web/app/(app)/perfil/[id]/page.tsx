'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarPlus, Mail, MessageSquare, Phone, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { useRealtime } from '@/components/communication/realtime-provider';
import { UserAvatar } from '@/components/communication/user-avatar';
import { MANUAL_STATUSES, PRESENCE_LABEL, type PresenceStatus } from '@/lib/communication/events';
import { SectionCard } from '@/components/platform/section-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  customStatus: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  company: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  defaultNode: { id: string; name: string; type: string; parent: { id: string; name: string } | null } | null;
  accessProfile: { id: string; name: string } | null;
  presence: { status: PresenceStatus; lastSeenAt: string | null };
}

interface Preferences {
  browserPush: boolean;
  emailDigest: boolean;
  muteMessages: boolean;
}

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const { presenceOf, setStatus: setRealtimeStatus } = useRealtime();
  const qc = useQueryClient();
  const isMe = user?.id === id;

  const profile = useQuery<ProfileData>({
    queryKey: ['profile', id],
    queryFn: () => api(`/communication/users/${id}/profile`),
    enabled: !!id,
  });

  if (profile.isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando perfil...</div>;
  }
  if (profile.isError || !profile.data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Perfil não encontrado.</div>;
  }

  const p = profile.data;
  const liveStatus = presenceOf(p.id, p.presence.status);
  const areaPath = [p.defaultNode?.parent?.name, p.defaultNode?.name].filter(Boolean).join(' › ');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Cabeçalho */}
      <Card>
        <CardContent className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <UserAvatar name={p.name} avatarUrl={p.avatarUrl} status={liveStatus} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{p.name}</h1>
            <p className="text-sm text-muted-foreground">{p.jobTitle ?? '—'}</p>
            {p.customStatus && <p className="mt-1 text-sm italic text-muted-foreground/90">“{p.customStatus}”</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{PRESENCE_LABEL[liveStatus]}</Badge>
              <Badge variant="outline" className="font-mono text-xs">{p.role}</Badge>
              {p.accessProfile && <Badge variant="outline">{p.accessProfile.name}</Badge>}
            </div>
          </div>
          {!isMe && (
            <div className="flex flex-col gap-2">
              <Button asChild size="sm">
                <Link href={`/comunicacao?to=${p.id}`}>
                  <MessageSquare className="mr-1.5 h-4 w-4" /> Enviar mensagem
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/meetings">
                  <CalendarPlus className="mr-1.5 h-4 w-4" /> Agendar reunião
                </Link>
              </Button>
            </div>
          )}
        </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Informações corporativas */}
        <SectionCard title="Informações" contentClassName="p-0">
          <dl className="divide-y divide-border/50 text-sm">
            <Info label="E-mail" value={p.email} icon={<Mail className="h-3.5 w-3.5" />} />
            <Info label="Telefone" value={p.phone ?? '—'} icon={<Phone className="h-3.5 w-3.5" />} />
            <Info label="Empresa" value={p.company?.name ?? '—'} />
            <Info label="Filial" value={p.branch?.name ?? '—'} />
            <Info label="Área / Setor" value={areaPath || '—'} />
            <Info
              label="Último acesso"
              value={
                p.lastLoginAt
                  ? formatDistanceToNow(new Date(p.lastLoginAt), { addSuffix: true, locale: ptBR })
                  : '—'
              }
            />
            <Info label="Membro desde" value={format(new Date(p.createdAt), 'dd/MM/yyyy', { locale: ptBR })} />
          </dl>
        </SectionCard>

        {/* Bio + (se for eu) edição */}
        <div className="space-y-4">
          <SectionCard title="Sobre">
            {p.bio ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground/70">Sem descrição.</p>
            )}
          </SectionCard>

          {isMe && (
            <>
              <SelfEditor profile={p} onSaved={() => qc.invalidateQueries({ queryKey: ['profile', id] })} />
              <StatusEditor
                current={liveStatus}
                onChange={async (status) => {
                  setRealtimeStatus(status);
                  try {
                    await api('/communication/me/status', { method: 'PATCH', json: { status } });
                    qc.invalidateQueries({ queryKey: ['profile', id] });
                  } catch {
                    toast.error('Não foi possível atualizar o status.');
                  }
                }}
              />
              <PreferencesEditor />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  );
}

function SelfEditor({ profile, onSaved }: { profile: ProfileData; onSaved: () => void }) {
  const [bio, setBio] = useState(profile.bio ?? '');
  const [customStatus, setCustomStatus] = useState(profile.customStatus ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');

  const save = useMutation({
    mutationFn: () => api('/communication/me/profile', { method: 'PATCH', json: { bio, customStatus, phone } }),
    onSuccess: () => {
      toast.success('Perfil atualizado.');
      onSaved();
    },
    onError: () => toast.error('Erro ao salvar o perfil.'),
  });

  return (
    <SectionCard title="Editar meu perfil">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status personalizado</label>
          <Input value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} placeholder="Ex.: Em campo, foco total..." />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone interno</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ramal ou telefone" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição profissional</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full rounded-md border border-border/60 bg-background p-2 text-sm"
            placeholder="Conte um pouco sobre seu trabalho..."
          />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm">
          <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </SectionCard>
  );
}

function StatusEditor({ current, onChange }: { current: PresenceStatus; onChange: (s: PresenceStatus) => void }) {
  return (
    <SectionCard title="Minha disponibilidade">
      <div className="flex flex-wrap gap-2">
        {MANUAL_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={current === s ? 'default' : 'outline'}
            onClick={() => onChange(s)}
          >
            {PRESENCE_LABEL[s]}
          </Button>
        ))}
      </div>
    </SectionCard>
  );
}

function PreferencesEditor() {
  const qc = useQueryClient();
  const prefs = useQuery<Preferences>({
    queryKey: ['my-preferences'],
    queryFn: () => api('/communication/me/preferences'),
  });
  const [local, setLocal] = useState<Preferences | null>(null);
  useEffect(() => {
    if (prefs.data) setLocal(prefs.data);
  }, [prefs.data]);

  const save = useMutation({
    mutationFn: (next: Preferences) => api('/communication/me/preferences', { method: 'PATCH', json: next }),
    onSuccess: () => {
      toast.success('Preferências salvas.');
      qc.invalidateQueries({ queryKey: ['my-preferences'] });
    },
    onError: () => toast.error('Erro ao salvar preferências.'),
  });

  if (!local) return null;
  const toggle = (key: keyof Preferences) => {
    const next = { ...local, [key]: !local[key] };
    setLocal(next);
    save.mutate(next);
  };

  return (
    <SectionCard title="Notificações">
      <div className="space-y-2 text-sm">
        <Toggle label="Notificações no navegador" checked={local.browserPush} onChange={() => toggle('browserPush')} />
        <Toggle label="Resumo por e-mail" checked={local.emailDigest} onChange={() => toggle('emailDigest')} />
        <Toggle label="Silenciar novas mensagens" checked={local.muteMessages} onChange={() => toggle('muteMessages')} />
      </div>
    </SectionCard>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-foreground" />
    </label>
  );
}
