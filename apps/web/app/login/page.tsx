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
import { Building2 } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

const schema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(6, 'Minimo 6 caracteres'),
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
      toast.error('Credenciais invalidas');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary to-purple-700 text-primary-foreground p-12">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/15 backdrop-blur">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Gestao 360 Indicadores</span>
        </div>
        <div className="space-y-4 max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight">
            Estrategia, indicadores e execucao em um unico lugar.
          </h1>
          <p className="text-primary-foreground/80">
            BSC, OKR, KPI, planos de acao, FCA, cronogramas e dashboards executivos. Tudo conectado para
            transformar dados em decisao.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/70">
          Demo: <strong>admin@demo.com</strong> / <strong>admin123</strong>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
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
