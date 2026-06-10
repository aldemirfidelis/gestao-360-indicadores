import { redirect } from 'next/navigation';

// Tela consolidada: regras de moderador agora são uma aba de /gestao-premio/ajustes.
export default function ModeratorsRedirect() {
  redirect('/gestao-premio/ajustes');
}
