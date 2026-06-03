'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';

/** Redireciona para o perfil do próprio usuário (editável). */
export default function MyProfileRedirect() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user?.id) router.replace(`/perfil/${user.id}`);
  }, [user?.id, router]);
  return <div className="py-12 text-center text-sm text-muted-foreground">Abrindo seu perfil...</div>;
}
