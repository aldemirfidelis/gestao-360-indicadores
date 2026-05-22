'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { BrandMark } from '@/components/brand/brand-mark';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'admin@demo.com', password: 'admin123' },
  });

  const onSubmit = async (data: Form) => {
    setBusy(true);
    try {
      await login(data.email, data.password);
      toast.success('Bem-vindo de volta!');
    } catch (err) {
      toast.error('Credenciais inválidas');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.32),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(124,58,237,0.22),transparent_30%)]" />
        <div className="absolute inset-x-12 bottom-20 h-px bg-white/20" />
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11" />
          <span className="text-lg font-semibold">Gestão 360</span>
        </div>
        <div className="relative max-w-lg space-y-4">
          <h1 className="text-4xl font-semibold leading-tight">
            Estratégia, indicadores e execução em um único lugar.
          </h1>
          <p className="text-primary-foreground/80">
            BSC, OKR, metas, planos de ação, reuniões, rastreabilidade e dashboards executivos. Tudo conectado para
            transformar dados em decisão.
          </p>
        </div>
        <div className="relative text-xs text-primary-foreground/70">
          Demo: <strong>admin@demo.com</strong> / <strong>admin123</strong>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="mb-3 flex items-center gap-3 lg:hidden">
              <BrandMark className="h-10 w-10" />
              <span className="text-base font-semibold">Gestão 360</span>
            </div>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use suas credenciais para acessar a plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
