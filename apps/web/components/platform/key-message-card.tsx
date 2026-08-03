'use client';

/**
 * Mensagem-chave do mês da área.
 *
 * É escrita uma vez no Painel Executivo (o gestor entra na sua área, filtra os
 * indicadores e registra a leitura do mês) e vale para toda a plataforma — a
 * apresentação da Reunião Mensal mostra a MESMA mensagem, nos mesmos moldes, em
 * vez de pedir que alguém redigite. Guardada por área em AppSetting, via
 * `/dashboard/area-conclusion`.
 */

import { useQuery } from '@tanstack/react-query';
import { Edit3, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export const KEY_MESSAGE_PLACEHOLDER = 'Nenhuma mensagem-chave registrada para esta área.';

export interface AreaKeyMessage {
  ownerNodeId: string;
  conclusion: string;
  updatedAt: string | null;
}

export function areaKeyMessageQueryKey(ownerNodeId: string) {
  return ['area-key-message', ownerNodeId];
}

export function useAreaKeyMessage(ownerNodeId?: string | null) {
  return useQuery<AreaKeyMessage>({
    queryKey: areaKeyMessageQueryKey(ownerNodeId ?? ''),
    queryFn: () => api<AreaKeyMessage>(`/dashboard/area-conclusion?ownerNodeId=${encodeURIComponent(ownerNodeId ?? '')}`),
    enabled: Boolean(ownerNodeId),
    // Quem não enxerga a área no painel recebe 403: a apresentação não pode
    // ficar tentando de novo por causa disso.
    retry: false,
  });
}

export function KeyMessageCard({
  message,
  onEdit,
  editDisabled,
  className,
}: {
  message: string;
  /** Sem editor (apresentação da reunião), o card é só leitura. */
  onEdit?: () => void;
  editDisabled?: boolean;
  className?: string;
}) {
  const text = message.trim();
  return (
    <Card className={cn('border-l-4 border-l-status-orange', className)}>
      <CardContent className="p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-foreground">
            <MessageSquareText className="h-4 w-4 shrink-0 text-status-orange" />
            <span>Mensagem-chave do mês</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {text || KEY_MESSAGE_PLACEHOLDER}
          </p>
        </div>
        {onEdit && (
          <Button className="mt-4 gap-2" type="button" variant="outline" onClick={onEdit} disabled={editDisabled}>
            <Edit3 className="h-4 w-4" />
            {text ? 'Editar mensagem' : 'Registrar mensagem'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
