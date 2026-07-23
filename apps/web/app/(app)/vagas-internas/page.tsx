'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Vagas internas virou uma aba de Minha Vida Funcional. Mantido como redirect
 * para não quebrar links/favoritos antigos. */
export default function LegacyInternalJobsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/servico-pessoal/meu-holerite?tab=vagas');
  }, [router]);
  return null;
}
