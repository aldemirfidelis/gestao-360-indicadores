'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { ProjectOptions } from './types';

/** Pessoas, indicadores e categorias usados nos formulários do módulo. */
export function useProjectOptions() {
  return useQuery<ProjectOptions>({
    queryKey: ['projects', 'options'],
    queryFn: () => api<ProjectOptions>('/projects/options'),
    staleTime: 60_000,
  });
}

export interface ProjectActionInput {
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  json?: unknown;
  /** Mensagem exibida quando a operação dá certo. */
  success?: string;
}

/** Escrita em qualquer parte do projeto: avisa o resultado e recarrega detalhe e portfólio. */
export function useProjectAction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectActionInput) => api<unknown>(input.path, { method: input.method, json: input.json }),
    onSuccess: (_data, input) => {
      if (input.success) toast.success(input.success);
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível concluir a operação.'),
  });
}

export type ProjectAction = ReturnType<typeof useProjectAction>;

/** Executa a operação e informa se deu certo; a falha já é exibida pelo próprio hook. */
export function settle(action: ProjectAction, input: ProjectActionInput): Promise<boolean> {
  return action.mutateAsync(input).then(() => true, () => false);
}
