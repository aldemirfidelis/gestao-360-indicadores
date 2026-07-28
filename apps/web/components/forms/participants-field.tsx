'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export interface Participant {
  employeeId?: string | null;
  registrationId: string;
  name: string;
  jobTitle: string | null;
  managerName: string | null;
}

/**
 * Participantes da inspeção, buscados pela matrícula.
 *
 * O executor digita a matrícula e o sistema traz nome, cargo/função e gestor
 * responsável do cadastro funcional — nada é redigitado, e não há cadastro
 * paralelo de pessoas. Os dados ficam gravados no registro: se a pessoa mudar
 * de cargo depois, o documento continua contando o que era verdade no dia.
 */
export function ParticipantsField({
  participants,
  onChange,
  disabled,
}: {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
  disabled?: boolean;
}) {
  const [matricula, setMatricula] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    const codigo = matricula.trim();
    if (!codigo) return;
    if (participants.some((item) => item.registrationId === codigo)) {
      toast.error('Esta matrícula já está na lista.');
      return;
    }

    setBusy(true);
    try {
      const found = await api<Participant>(`/forms/participants/lookup?matricula=${encodeURIComponent(codigo)}`);
      onChange([...participants, found]);
      setMatricula('');
    } catch (error) {
      toast.error((error as Error).message ?? 'Matrícula não encontrada.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={matricula}
          onChange={(event) => setMatricula(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void add();
            }
          }}
          placeholder="Matrícula do participante"
          disabled={disabled || busy}
          className="max-w-56"
        />
        <Button type="button" variant="outline" onClick={() => void add()} disabled={disabled || busy || !matricula.trim()}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Adicionar
        </Button>
      </div>

      {participants.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Digite a matrícula e o nome, cargo e gestor vêm do cadastro funcional.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {participants.map((person, index) => (
            <li key={person.registrationId} className="flex items-center gap-3 p-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
                <UserRound className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {person.name} <span className="text-xs font-normal text-muted-foreground">· {person.registrationId}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[person.jobTitle, person.managerName ? `Gestor: ${person.managerName}` : null].filter(Boolean).join(' · ') || 'Sem cargo cadastrado'}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(participants.filter((_, i) => i !== index))}
                aria-label={`Remover ${person.name}`}
                className="rounded-md p-1.5 text-status-red hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Rodapé do formulário: repete quem participou e quem responde pela área.
 * É o bloco que fecha o documento da inspeção.
 */
export function ParticipantsFooter({ participants }: { participants: Participant[] }) {
  if (participants.length === 0) return null;
  const gestores = [...new Set(participants.map((item) => item.managerName).filter(Boolean))] as string[];

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
      <p className="mb-1.5 font-semibold uppercase text-muted-foreground">Participantes</p>
      <ul className="space-y-0.5">
        {participants.map((person) => (
          <li key={person.registrationId}>
            <span className="font-medium">{person.name}</span>
            {person.jobTitle ? ` — ${person.jobTitle}` : ''}
          </li>
        ))}
      </ul>
      {gestores.length > 0 && (
        <p className="mt-2 border-t pt-2">
          <span className="font-semibold uppercase text-muted-foreground">Gestor responsável: </span>
          {gestores.join(', ')}
        </p>
      )}
    </div>
  );
}
