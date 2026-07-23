'use client';

import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { KioskClock } from '@/components/personnel/kiosk-clock';

export default function TotemPage() {
  const { user, loading, hasPermission, logout } = useAuth();

  if (loading) {
    return (
      <main className="fixed inset-0 z-[100] grid place-items-center bg-slate-950 text-sm text-slate-400">
        Carregando terminal...
      </main>
    );
  }

  if (!user) return null;

  if (!hasPermission(['ponto:kiosk', 'ponto:manage'])) {
    return (
      <main className="fixed inset-0 z-[100] grid place-items-center bg-slate-950 p-6 text-white">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-lg font-black">Acesso restrito</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Esta conta não tem permissão para acessar o terminal de reconhecimento facial. Peça ao administrador do
            ponto para usar o login específico do totem.
          </p>
          <Button type="button" variant="outline" className="mt-5 w-full border-white/15 text-white hover:bg-white/10 hover:text-white" onClick={() => logout()}>
            Sair
          </Button>
        </div>
      </main>
    );
  }

  return <KioskClock />;
}
