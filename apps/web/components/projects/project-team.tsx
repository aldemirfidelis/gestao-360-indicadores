'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { IconButton } from './project-schedule';
import type { PersonOption, ProjectDetail, ProjectMember } from './types';
import { settle, type ProjectAction } from './use-project';

const EXTERNAL = '__external__';
const EMPTY = { userId: '', name: '', role: '', allocation: '' };

/** Equipe do projeto: gerente, patrocinador e participantes (usuários ou externos). */
export function ProjectTeam({
  project,
  canEdit,
  action,
  people,
}: {
  project: ProjectDetail;
  canEdit: boolean;
  action: ProjectAction;
  people: PersonOption[];
}) {
  const [dialog, setDialog] = useState<{ open: boolean; member: ProjectMember | null }>({ open: false, member: null });
  const [toDelete, setToDelete] = useState<ProjectMember | null>(null);
  const taken = new Set(project.members.map((member) => member.userId).filter(Boolean));
  const openTasksOf = (member: ProjectMember) =>
    project.tasks.filter((task) => task.progress < 100 && (member.userId ? task.assigneeId === member.userId : !task.assigneeId && task.responsible === member.name)).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Lead title="Gerente do projeto" name={project.manager?.name ?? project.responsible} detail={project.manager?.jobTitle ?? null} />
        <Lead title="Patrocinador" name={project.sponsor} detail={null} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Participantes ({project.members.length})</CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => setDialog({ open: true, member: null })}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar participante
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {project.members.length === 0 ? (
            <EmptyState
              title="Nenhum participante na equipe"
              description="Inclua as pessoas envolvidas, o papel de cada uma e a dedicação ao projeto."
              action={canEdit ? <Button size="sm" onClick={() => setDialog({ open: true, member: null })}><Plus className="mr-2 h-4 w-4" /> Adicionar participante</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Pessoa</th>
                    <th className="py-2 pr-3 font-medium">Papel no projeto</th>
                    <th className="py-2 pr-3 text-right font-medium">Dedicação</th>
                    <th className="py-2 pr-3 text-right font-medium">Tarefas abertas</th>
                    {canEdit && <th className="py-2 text-right font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {project.members.map((member) => (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.userId ? member.user?.jobTitle ?? 'Usuário do sistema' : 'Participante externo'}</div>
                      </td>
                      <td className="py-2 pr-3">{member.role ?? '—'}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{member.allocation === null ? '—' : `${member.allocation}%`}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{openTasksOf(member)}</td>
                      {canEdit && (
                        <td className="py-2">
                          <div className="flex justify-end gap-0.5">
                            <IconButton label={`Editar ${member.name}`} disabled={action.isPending} onClick={() => setDialog({ open: true, member })}>
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton label={`Remover ${member.name}`} disabled={action.isPending} onClick={() => setToDelete(member)}>
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <MemberDialog
        open={dialog.open}
        member={dialog.member}
        projectId={project.id}
        people={people.filter((person) => !taken.has(person.id))}
        action={action}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Remover participante"
        description={toDelete ? `${toDelete.name} deixará a equipe do projeto. As tarefas atribuídas a essa pessoa não são alteradas.` : undefined}
        confirmLabel="Remover"
        destructive
        onConfirm={async () => {
          if (toDelete) await settle(action, { path: `/projects/members/${toDelete.id}`, method: 'DELETE', success: 'Participante removido' });
        }}
      />
    </div>
  );
}

function Lead({ title, name, detail }: { title: string; name: string | null | undefined; detail: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase text-muted-foreground">{title}</div>
        <div className="truncate font-semibold">{name ?? 'Não definido'}</div>
        {detail && <div className="truncate text-xs text-muted-foreground">{detail}</div>}
      </div>
    </div>
  );
}

function MemberDialog({
  open,
  member,
  projectId,
  people,
  action,
  onOpenChange,
}: {
  open: boolean;
  member: ProjectMember | null;
  projectId: string;
  /** Pessoas que ainda não estão na equipe. */
  people: PersonOption[];
  action: ProjectAction;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(member
      ? {
          userId: member.userId ?? EXTERNAL,
          name: member.name,
          role: member.role ?? '',
          allocation: member.allocation === null ? '' : String(member.allocation),
        }
      : EMPTY);
  }, [open, member]);

  async function submit() {
    const allocation = form.allocation.trim() === '' ? null : Number(form.allocation);
    if (allocation !== null && (!Number.isInteger(allocation) || allocation < 0 || allocation > 100)) {
      toast.error('Informe a dedicação como um número inteiro entre 0 e 100.');
      return;
    }
    const external = form.userId === EXTERNAL;
    if (!member && !form.userId) {
      toast.error('Selecione a pessoa.');
      return;
    }
    if (external && !form.name.trim()) {
      toast.error('Informe o nome do participante.');
      return;
    }
    const json: Record<string, unknown> = { role: form.role.trim() || null, allocation };
    if (external) json.name = form.name.trim();
    else if (!member) json.userId = form.userId;
    const saved = await settle(action, member
      ? { path: `/projects/members/${member.id}`, method: 'PATCH', json, success: 'Participante atualizado' }
      : { path: `/projects/${projectId}/members`, method: 'POST', json, success: 'Participante adicionado' });
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !action.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{member ? 'Editar participante' : 'Adicionar participante'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="member-user">Pessoa *</Label>
            {member ? (
              member.userId
                ? <Input id="member-user" value={member.name} disabled />
                : <Input id="member-user" value={form.name} maxLength={180} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            ) : (
              <>
                <NativeSelect id="member-user" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                  <option value="">Selecione</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}{person.jobTitle ? ` — ${person.jobTitle}` : ''}
                    </option>
                  ))}
                  <option value={EXTERNAL}>Participante externo (sem usuário no sistema)</option>
                </NativeSelect>
                {form.userId === EXTERNAL && (
                  <Input aria-label="Nome do participante" value={form.name} maxLength={180} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do participante" />
                )}
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr,150px]">
            <div className="space-y-2">
              <Label htmlFor="member-role">Papel no projeto</Label>
              <Input id="member-role" value={form.role} maxLength={120} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ex.: Líder técnico" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-allocation">Dedicação (%)</Label>
              <Input id="member-allocation" type="number" min={0} max={100} step={1} value={form.allocation} onChange={(e) => setForm({ ...form, allocation: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={action.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={action.isPending}>
            {action.isPending ? 'Salvando...' : member ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
