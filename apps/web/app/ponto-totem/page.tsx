'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Endereço antigo do totem (público, sem login). Mantido só para redirecionar
 * quem tinha o link salvo — o terminal real agora vive em /totem, atrás de login. */
export default function LegacyKioskRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/totem');
  }, [router]);
  return null;
}
