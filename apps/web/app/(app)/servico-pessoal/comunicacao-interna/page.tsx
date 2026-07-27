'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Rota estável da Comunicação Interna do colaborador. É o endereço usado por
 * notificações, QR code e Meu Dia; redireciona para a aba dentro de Minha Vida
 * Funcional preservando o comunicado pedido (?post=).
 */
export default function ComunicacaoInternaRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const post = searchParams.get('post');

  useEffect(() => {
    router.replace(`/servico-pessoal/meu-holerite?tab=comunicacao${post ? `&post=${post}` : ''}`);
  }, [router, post]);

  return null;
}
