'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { JobOption } from '@/lib/compensation/types';

export interface DescriptionRecord {
  id: string;
  version: number;
  status: string;
  jobCatalogId?: string;
  jobCatalog?: JobOption;
  mission?: string | null;
  responsibilities?: string | null;
  detailedActivities?: string | null;
  expectedDeliverables?: string | null;
  technicalSkills?: string | null;
  behavioralSkills?: string | null;
  knowledge?: string | null;
  tools?: string | null;
  minimumEducation?: string | null;
  desiredEducation?: string | null;
  requiredExperience?: string | null;
  requiredCourses?: string | null;
  certifications?: string | null;
  occupationalRisks?: string | null;
  epis?: string | null;
  legalRequirements?: string | null;
  workEnvironment?: string | null;
  autonomyLevel?: string | null;
  directReports?: string | null;
  immediateSuperior?: string | null;
  internalInterfaces?: string | null;
  externalInterfaces?: string | null;
  notes?: string | null;
}

const FIELDS = [
  'mission', 'responsibilities', 'detailedActivities', 'expectedDeliverables',
  'technicalSkills', 'behavioralSkills', 'knowledge', 'tools',
  'minimumEducation', 'desiredEducation', 'requiredExperience', 'requiredCourses', 'certifications',
  'occupationalRisks', 'epis', 'legalRequirements', 'workEnvironment',
  'autonomyLevel', 'directReports', 'immediateSuperior', 'internalInterfaces', 'externalInterfaces', 'notes',
] as const;
type Field = (typeof FIELDS)[number];

function blankForm(): Record<Field, string> & { jobCatalogId: string } {
  return { jobCatalogId: '', ...Object.fromEntries(FIELDS.map((f) => [f, ''])) } as any;
}

function fromRecord(record: DescriptionRecord) {
  const form = blankForm();
  form.jobCatalogId = record.jobCatalogId ?? record.jobCatalog?.id ?? '';
  for (const field of FIELDS) form[field] = (record[field] as string | null) ?? '';
  return form;
}

export function DescriptionEditorDialog({
  open,
  mode,
  record,
  jobs,
  canManage,
  onClose,
}: {
  open: boolean;
  mode: 'new' | 'edit';
  record: DescriptionRecord | null;
  jobs: JobOption[];
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(blankForm());

  useEffect(() => {
    setForm(mode === 'edit' && record ? fromRecord(record) : blankForm());
  }, [mode, record, open]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['compensation', 'descriptions'] });

  const save = useMutation({
    mutationFn: () =>
      mode === 'edit' && record
        ? api(`/cargos-salarios/descriptions/${record.id}`, { method: 'PATCH', json: form })
        : api('/cargos-salarios/descriptions', { method: 'POST', json: form }),
    onSuccess: () => {
      toast.success(mode === 'edit' ? 'Descrição atualizada' : 'Descrição criada');
      invalidate();
      onClose();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao salvar descrição'),
  });

  const set = (field: Field | 'jobCatalogId', value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? `Editar descrição v${record?.version}` : 'Nova descrição'}</DialogTitle>
        </DialogHeader>

        <div>
          <Label>Cargo</Label>
          <NativeSelect value={form.jobCatalogId} onChange={(e) => set('jobCatalogId', e.target.value)} disabled={mode === 'edit'}>
            <option value="">Selecione</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.code} - {job.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <Tabs defaultValue="conteudo" className="mt-2">
          <TabsList>
            <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
            <TabsTrigger value="competencias">Competências</TabsTrigger>
            <TabsTrigger value="requisitos">Requisitos</TabsTrigger>
            <TabsTrigger value="contexto">Contexto</TabsTrigger>
          </TabsList>

          <fieldset disabled={!canManage}>
            <TabsContent value="conteudo" className="space-y-3">
              <Area label="Missão do cargo" value={form.mission} onChange={(v) => set('mission', v)} rows={3} />
              <Area label="Principais responsabilidades" value={form.responsibilities} onChange={(v) => set('responsibilities', v)} rows={4} />
              <Area label="Atividades detalhadas" value={form.detailedActivities} onChange={(v) => set('detailedActivities', v)} rows={4} />
              <Area label="Entregas esperadas" value={form.expectedDeliverables} onChange={(v) => set('expectedDeliverables', v)} rows={3} />
            </TabsContent>

            <TabsContent value="competencias" className="space-y-3">
              <Area label="Competências técnicas" value={form.technicalSkills} onChange={(v) => set('technicalSkills', v)} rows={3} />
              <Area label="Competências comportamentais" value={form.behavioralSkills} onChange={(v) => set('behavioralSkills', v)} rows={3} />
              <Area label="Conhecimentos" value={form.knowledge} onChange={(v) => set('knowledge', v)} rows={3} />
              <Area label="Ferramentas e sistemas" value={form.tools} onChange={(v) => set('tools', v)} rows={2} />
            </TabsContent>

            <TabsContent value="requisitos" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field2 label="Formação mínima" value={form.minimumEducation} onChange={(v) => set('minimumEducation', v)} />
              <Field2 label="Formação desejada" value={form.desiredEducation} onChange={(v) => set('desiredEducation', v)} />
              <Area label="Experiência exigida" value={form.requiredExperience} onChange={(v) => set('requiredExperience', v)} rows={2} className="sm:col-span-2" />
              <Field2 label="Cursos exigidos" value={form.requiredCourses} onChange={(v) => set('requiredCourses', v)} />
              <Field2 label="Certificações" value={form.certifications} onChange={(v) => set('certifications', v)} />
              <Field2 label="Requisitos legais" value={form.legalRequirements} onChange={(v) => set('legalRequirements', v)} />
            </TabsContent>

            <TabsContent value="contexto" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field2 label="Superior imediato" value={form.immediateSuperior} onChange={(v) => set('immediateSuperior', v)} />
              <Field2 label="Subordinados diretos" value={form.directReports} onChange={(v) => set('directReports', v)} />
              <Field2 label="Nível de autonomia" value={form.autonomyLevel} onChange={(v) => set('autonomyLevel', v)} />
              <Field2 label="Ambiente de trabalho" value={form.workEnvironment} onChange={(v) => set('workEnvironment', v)} />
              <Field2 label="Interfaces internas" value={form.internalInterfaces} onChange={(v) => set('internalInterfaces', v)} />
              <Field2 label="Interfaces externas" value={form.externalInterfaces} onChange={(v) => set('externalInterfaces', v)} />
              <Area label="Riscos ocupacionais" value={form.occupationalRisks} onChange={(v) => set('occupationalRisks', v)} rows={2} />
              <Area label="EPIs" value={form.epis} onChange={(v) => set('epis', v)} rows={2} />
              <Area label="Observações" value={form.notes} onChange={(v) => set('notes', v)} rows={2} className="sm:col-span-2" />
            </TabsContent>
          </fieldset>
        </Tabs>

        {canManage && (
          <div className="mt-2 flex justify-end border-t pt-4">
            <Button onClick={() => save.mutate()} disabled={!form.jobCatalogId || save.isPending}>
              <Save className="mr-1.5 h-4 w-4" /> {mode === 'edit' ? 'Salvar alterações' : 'Criar descrição'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Area({ label, value, onChange, rows = 3, className }: { label: string; value: string; onChange: (v: string) => void; rows?: number; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Field2({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
