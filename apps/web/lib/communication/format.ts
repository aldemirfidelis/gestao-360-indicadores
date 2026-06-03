import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Horário curto para a lista de conversas (HH:mm hoje, senão dd/MM). */
export function shortTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'ontem';
  return format(d, 'dd/MM');
}

/** Horário da mensagem (HH:mm). */
export function messageTime(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

/** Rótulo do separador de data dentro do thread. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function dayKey(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd');
}
