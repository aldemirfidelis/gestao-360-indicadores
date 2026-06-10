import { redirect } from 'next/navigation';

// Tela consolidada: Previsto × Realizado agora é uma aba de /gestao-premio/realizado.
export default function PrevistoRealizadoRedirect() {
  redirect('/gestao-premio/realizado');
}
