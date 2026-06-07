'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { platformAdminApi, setPlatformAdminTokens } from '@/lib/platform-admin-api';

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const out = await platformAdminApi<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      setPlatformAdminTokens(out.accessToken, out.refreshToken);
      toast.success('Portal Admin Global conectado');
      router.replace('/platform-admin');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credenciais invalidas');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#101820] text-white">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr,1.05fr]">
        <section className="flex flex-col justify-between border-r border-white/10 p-8 lg:p-12">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-white/25 bg-white/10">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Gestao 360</div>
              <div className="text-lg font-semibold">Portal Admin Global</div>
            </div>
          </div>
          <div className="max-w-xl py-16">
            <h1 className="text-4xl font-semibold leading-tight">Central interna da plataforma</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/70">
              Acesso separado para administracao tecnica, suporte, implantacao, planos, modulos e auditoria da plataforma.
            </p>
          </div>
          <div className="text-xs text-white/45">Ambiente separado das telas operacionais das empresas.</div>
        </section>

        <section className="flex items-center justify-center p-6">
          <form onSubmit={submit} className="w-full max-w-sm border border-white/12 bg-white p-6 text-foreground shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center border bg-foreground text-background">
                <LockKeyhole className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Entrar no admin global</h2>
                <p className="text-xs text-muted-foreground">Use sua credencial interna da plataforma.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform-email">E-mail interno</Label>
                <Input id="platform-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform-password">Senha</Label>
                <Input id="platform-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <Button className="w-full" disabled={busy}>
                {busy ? 'Validando...' : 'Entrar'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
