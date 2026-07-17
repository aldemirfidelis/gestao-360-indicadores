'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Hash, IdCard, Save } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { LoadingState } from '@/components/platform/loading-state';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface Settings {
  autoGenerateRegistration: boolean;
  allowManualRegistration: boolean;
  registrationPrefix: string;
  registrationSuffix: string;
  registrationWidth: number;
  registrationPadChar: string;
  registrationNextSequence: number;
  badgeAccentColor: string;
  badgeOrientation: 'PORTRAIT' | 'LANDSCAPE';
  badgeShowPhoto: boolean;
  badgeShowQr: boolean;
  badgeShowJob: boolean;
  badgeShowAdmission: boolean;
  badgeShowRegistration: boolean;
  badgeFooterText: string | null;
}

export default function PersonnelSettingsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['pessoal:settings', 'pessoal:manage']);
  const [form, setForm] = useState<Settings | null>(null);

  const settingsQuery = useQuery<Settings>({ queryKey: ['personnel-settings'], queryFn: () => api('/personnel/settings') });

  useEffect(() => {
    if (settingsQuery.data && !form) setForm(settingsQuery.data);
  }, [settingsQuery.data, form]);

  const save = useMutation({
    mutationFn: () => api('/personnel/settings', { method: 'PATCH', json: form }),
    onSuccess: () => {
      toast.success('Configurações salvas.');
      void qc.invalidateQueries({ queryKey: ['personnel-settings'] });
      void qc.invalidateQueries({ queryKey: ['personnel-registration-preview'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar.'),
  });

  // Preview local da próxima matrícula (espelha o formatRegistration do backend).
  const preview = useMemo(() => {
    if (!form) return '';
    const width = Math.max(0, Math.min(12, Math.trunc(form.registrationWidth) || 0));
    const pad = (form.registrationPadChar || '0').slice(0, 1) || '0';
    const seq = String(Math.max(0, Math.trunc(form.registrationNextSequence) || 0));
    const body = width > 0 ? seq.padStart(width, pad) : seq;
    return `${form.registrationPrefix ?? ''}${body}${form.registrationSuffix ?? ''}`;
  }, [form]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  if (settingsQuery.isLoading || !form) {
    return (
      <div className="space-y-4">
        <PageHeader title="Configurações" description="Serviço Pessoal" />
        <LoadingState label="Carregando configurações..." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurações do Serviço Pessoal"
        description="Numeração da matrícula do colaborador e modelo do crachá de identificação."
        actions={
          canManage && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          )
        }
      />

      {/* Numeração de matrícula */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-sky-500" />
            <h2 className="text-sm font-semibold">Numeração de matrícula</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Define como o número de cadastro (matrícula/crachá) é gerado na admissão. A matrícula digitada manualmente sempre tem prioridade;
            sem ela, o sistema gera pelo formato abaixo. Serve tanto para a admissão vinda do Recrutamento quanto para o cadastro direto.
          </p>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={!canManage} checked={form.autoGenerateRegistration} onChange={(e) => set('autoGenerateRegistration', e.target.checked)} />
              Gerar matrícula automaticamente
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={!canManage} checked={form.allowManualRegistration} onChange={(e) => set('allowManualRegistration', e.target.checked)} />
              Permitir digitar/sobrescrever manualmente
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="text-xs">Prefixo</Label>
              <Input disabled={!canManage} placeholder="ex.: 9 ou MAT-" value={form.registrationPrefix} onChange={(e) => set('registrationPrefix', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Largura do número</Label>
              <Input type="number" min={0} max={12} disabled={!canManage} value={form.registrationWidth} onChange={(e) => set('registrationWidth', Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Preenchimento</Label>
              <Input maxLength={1} disabled={!canManage} value={form.registrationPadChar} onChange={(e) => set('registrationPadChar', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Sufixo</Label>
              <Input disabled={!canManage} placeholder="opcional" value={form.registrationSuffix} onChange={(e) => set('registrationSuffix', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Próximo número</Label>
              <Input type="number" min={0} disabled={!canManage} value={form.registrationNextSequence} onChange={(e) => set('registrationNextSequence', Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-sm">
            <IdCard className="h-4 w-4 text-sky-500" />
            <span className="text-muted-foreground">Próxima matrícula:</span>
            <span className="font-mono text-base font-bold text-sky-600 dark:text-sky-400">{preview || '—'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Template do crachá */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-sky-500" />
            <h2 className="text-sm font-semibold">Modelo do crachá</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Modelo usado ao gerar o crachá no prontuário do colaborador. O logo vem do cadastro da empresa e a foto do prontuário; a geração
            (PNG/JPEG/PDF) acontece na tela do colaborador.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs">Cor de destaque</Label>
              <div className="flex items-center gap-2">
                <input type="color" disabled={!canManage} value={/^#[0-9a-fA-F]{6}$/.test(form.badgeAccentColor) ? form.badgeAccentColor : '#0ea5e9'} onChange={(e) => set('badgeAccentColor', e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                <Input disabled={!canManage} value={form.badgeAccentColor} onChange={(e) => set('badgeAccentColor', e.target.value)} className="font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Orientação</Label>
              <NativeSelect disabled={!canManage} value={form.badgeOrientation} onChange={(e) => set('badgeOrientation', e.target.value as Settings['badgeOrientation'])}>
                <option value="PORTRAIT">Retrato (vertical)</option>
                <option value="LANDSCAPE">Paisagem (horizontal)</option>
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">Texto de rodapé (opcional)</Label>
              <Input disabled={!canManage} placeholder="ex.: Documento de identificação interna" value={form.badgeFooterText ?? ''} onChange={(e) => set('badgeFooterText', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Elementos exibidos</Label>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
              <Toggle label="Foto" disabled={!canManage} checked={form.badgeShowPhoto} onChange={(v) => set('badgeShowPhoto', v)} />
              <Toggle label="Matrícula" disabled={!canManage} checked={form.badgeShowRegistration} onChange={(v) => set('badgeShowRegistration', v)} />
              <Toggle label="QR Code" disabled={!canManage} checked={form.badgeShowQr} onChange={(v) => set('badgeShowQr', v)} />
              <Toggle label="Cargo" disabled={!canManage} checked={form.badgeShowJob} onChange={(v) => set('badgeShowJob', v)} />
              <Toggle label="Data de admissão" disabled={!canManage} checked={form.badgeShowAdmission} onChange={(v) => set('badgeShowAdmission', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salvar configurações
          </Button>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
