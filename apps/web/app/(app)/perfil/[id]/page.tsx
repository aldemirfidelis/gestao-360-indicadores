'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Mail, Phone, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { UserAvatar } from '@/components/communication/user-avatar';
import { type PresenceStatus } from '@/lib/communication/events';
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

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const qc = useQueryClient();
  const isMe = user?.id === id;

  const profile = useQuery<ProfileData>({
    queryKey: ['profile', user?.companyId, id],
    queryFn: () => api('/profile/me'),
    enabled: !!id && isMe,
  });

  if (!isMe) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Somente o próprio perfil está disponível nesta versão.</div>;
  }

  if (profile.isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando perfil...</div>;
  }
  if (profile.isError || !profile.data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Perfil não encontrado.</div>;
  }

  const p = profile.data;
  const areaPath = [p.defaultNode?.parent?.name, p.defaultNode?.name].filter(Boolean).join(' › ');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Cabeçalho */}
      <Card>
        <CardContent className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <UserAvatar name={p.name} avatarUrl={p.avatarUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{p.name}</h1>
            <p className="text-sm text-muted-foreground">{p.jobTitle ?? '—'}</p>
            {p.customStatus && <p className="mt-1 text-sm italic text-muted-foreground/90">“{p.customStatus}”</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">{p.role}</Badge>
              {p.accessProfile && <Badge variant="outline">{p.accessProfile.name}</Badge>}
            </div>
          </div>
        </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Informações corporativas */}
        <div className="space-y-4">
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

        </div>

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
              <SelfEditor profile={p} onSaved={() => qc.invalidateQueries({ queryKey: ['profile', user?.companyId, id] })} />
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
    mutationFn: () => api('/profile/me', { method: 'PATCH', json: { bio, customStatus, phone } }),
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
