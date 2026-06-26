'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { BrandLogo } from '@/components/brand/brand-logo';
import { fetchTenantBranding, type TenantBranding } from '@/lib/tenant';
import { ShieldCheck, BarChart3, Users, Zap } from 'lucide-react';

const schema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(6, 'Mínimo de 6 caracteres.'),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [tenant, setTenant] = useState<TenantBranding | null>(null);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'demo@demo.com', password: '123456' },
  });

  useEffect(() => {
    // Branding por tenant: resolve a empresa pelo host (subdomínio/domínio próprio).
    fetchTenantBranding().then(setTenant).catch(() => setTenant(null));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let cameFromDemoButton = params.get('demo') === '1';

    try {
      cameFromDemoButton = cameFromDemoButton || window.sessionStorage.getItem('g360.demoEntry') !== null;
    } catch {
      cameFromDemoButton = cameFromDemoButton || params.get('demo') === '1';
    }

    if (cameFromDemoButton) {
      setDemoMode(true);
      try {
        window.sessionStorage.setItem(
          'g360.demoAccessIntent',
          JSON.stringify({ page: window.location.pathname, detectedAt: new Date().toISOString() }),
        );
      } catch {
        /* Storage pode estar bloqueado; a demonstração continua acessível. */
      }
    }
  }, []);

  const onSubmit = async (data: Form) => {
    setBusy(true);
    try {
      await login(data.email, data.password);
      toast.success(demoMode ? 'Demonstração acessada.' : 'Bem-vindo de volta!');
    } catch (err) {
      toast.error('Credenciais inválidas.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr] bg-[#030712] overflow-hidden">
      {/* Painel Esquerdo: Marketing Pitch & Visual Premium */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-16 border-r border-slate-900">
        {/* Glowing gradients & Mesh effect */}
        <div className="absolute inset-0 bg-[#060b18]" />
        <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.15)_0%,transparent_70%)] filter blur-[100px] animate-pulse duration-5000" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.1)_0%,transparent_70%)] filter blur-[100px] animate-pulse duration-7000" />
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
        />

        {/* Top Header Branding */}
        <div className="relative z-10 flex items-center gap-3">
          {tenant?.logoUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tenant.logoUrl} alt={tenant.name} className="h-11 w-11 rounded-xl bg-white/90 object-contain p-1.5 shadow-lg border border-slate-200/20" />
              <span className="text-xl font-bold text-white tracking-wide">{tenant.name}</span>
            </div>
          ) : (
            <BrandLogo variant="horizontal" theme="dark" size="md" animated={true} />
          )}
        </div>

        {/* Center Pitch Content & Floating Premium Card */}
        <div className="relative z-10 my-auto max-w-2xl space-y-12">
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.1] text-white tracking-tight">
              Conecte estratégia, indicadores e execução em um só lugar.
            </h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-xl">
              Centralize OKRs, KPIs, planos de ação, gestão de riscos e comitês corporativos. A solução completa para governança e melhoria contínua da sua empresa.
            </p>
          </div>

          {/* Floating UI Widget Mockup */}
          <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6 backdrop-blur-xl shadow-2xl max-w-md transition-all duration-300 hover:scale-[1.02] hover:border-slate-700/60">
            <div className="absolute top-0 right-0 w-[150px] h-[150px] rounded-full bg-cyan-500/5 filter blur-[40px]" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Meta Global Q2</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">+12.4%</span>
            </div>
            
            <div className="text-xl font-bold text-white tracking-tight">Desempenho Geral Corporativo</div>
            
            <div className="mt-5 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Atingimento Acumulado</span>
                <span className="font-semibold text-white">88.5%</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-gradient-to-r from-[#00F0FF] to-blue-500 rounded-full" style={{ width: '88.5%' }} />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> 24 equipes ativas</span>
              <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Atualizado em tempo real</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#00F0FF]" />
          <span>Conexão criptografada de alta segurança.</span>
        </div>
      </div>

      {/* Painel Direito: Form de Login */}
      <div className="relative flex items-center justify-center p-6 sm:p-12 md:p-16">
        {/* Soft mobile background glow */}
        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.08)_0%,transparent_70%)] filter blur-[50px] lg:hidden" />
        
        <div className="w-full max-w-md space-y-8 relative z-10">
          {/* Mobile logo header */}
          <div className="flex flex-col items-center text-center lg:hidden gap-2 mb-8">
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-12 w-12 rounded-xl bg-white object-contain p-1 shadow-md" />
            ) : (
              <BrandLogo variant="icon" size="lg" animated={true} />
            )}
            <h2 className="mt-4 text-2xl font-bold text-white">
              {tenant?.name ?? 'Gestão 360'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">Portal de acesso corporativo</p>
          </div>

          <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden p-6 sm:p-8">
            <CardHeader className="space-y-2 p-0 pb-6 border-b border-slate-800/60">
              <CardTitle className="text-2xl font-bold text-white tracking-tight">
                {demoMode ? 'Acessar demonstração' : 'Entrar na plataforma'}
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                {demoMode
                  ? 'Conheça o Gestão 360 com dados pré-preenchidos e simulados.'
                  : 'Insira seu e-mail e senha cadastrados para acessar o portal.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">E-mail</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    autoComplete="email" 
                    {...form.register('email')}
                    className="h-11 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500 rounded-xl"
                    placeholder="nome@empresa.com"
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-red-400 mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Senha</Label>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    autoComplete="current-password" 
                    {...form.register('password')}
                    className="h-11 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500 rounded-xl"
                    placeholder="••••••••"
                  />
                  {form.formState.errors.password && (
                    <p className="text-xs text-red-400 mt-1">{form.formState.errors.password.message}</p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  disabled={busy} 
                  className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold tracking-wide rounded-xl shadow-[0_4px_20px_rgba(6,182,212,0.2)] transition-all duration-200 disabled:opacity-50"
                >
                  {busy ? 'Entrando...' : demoMode ? 'Acessar demonstração' : 'Entrar no sistema'}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <div className="text-center text-xs text-slate-500">
            Dúvidas sobre o acesso? <a href="/suporte" className="text-cyan-400 hover:underline">Fale com o suporte</a>.
          </div>
        </div>
      </div>
    </div>
  );
}
