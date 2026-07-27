'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, Field } from './ui';
import { SocialLogin } from './social-login';

export type AuthMode = 'login' | 'register' | 'reset';

export interface AuthFormState {
  name: string;
  email: string;
  phone: string;
  code: string;
  password: string;
}

const BENEFITS = [
  { icon: BriefcaseBusiness, title: 'Um perfil, várias empresas', text: 'O mesmo cadastro serve para todas as vagas publicadas na plataforma.' },
  { icon: CheckCircle2, title: 'Acompanhe cada etapa', text: 'Veja em que fase está sua candidatura, sem precisar ligar para o RH.' },
  { icon: ShieldCheck, title: 'Seus dados sob seu controle', text: 'Você pode pedir acesso, correção ou exclusão dos seus dados quando quiser.' },
];

/**
 * Entrada do portal do candidato: login, cadastro e redefinição de senha.
 *
 * Um painel só, com o contexto do lado esquerdo (o candidato costuma chegar de
 * um anúncio de vaga e precisa saber onde está) e o formulário à direita.
 */
export function AuthScreen({
  mode,
  onModeChange,
  form,
  onFormChange,
  onSubmit,
  onRequestReset,
  loading,
  message,
  errorMessage,
  vacanciesHref,
  returnTo,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  form: AuthFormState;
  onFormChange: (patch: Partial<AuthFormState>) => void;
  onSubmit: () => void;
  onRequestReset: () => void;
  loading: boolean;
  message: string | null;
  errorMessage: string | null;
  vacanciesHref: string;
  returnTo: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit =
    mode === 'reset'
      ? Boolean(form.email && form.code && form.password)
      : Boolean(form.email && form.password && (mode !== 'register' || form.name));

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        {/* Contexto: por que criar conta. Fora da vista no celular, onde o
            formulário precisa vir primeiro. */}
        <aside className="hidden flex-col justify-between bg-slate-900 p-10 text-slate-100 lg:flex">
          <Link href={vacanciesHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
            <BriefcaseBusiness className="h-4 w-4" /> Portal de vagas
          </Link>
          <div className="space-y-8">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300">
                <Sparkles className="h-3.5 w-3.5" /> Área do candidato
              </span>
              <h1 className="mt-4 text-3xl font-bold leading-tight">
                Acompanhe suas candidaturas
                <br />
                em um só lugar.
              </h1>
            </div>
            <ul className="space-y-5">
              {BENEFITS.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-500">Gestão 360 · Recrutamento e Seleção</p>
        </aside>

        <div className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-6 lg:hidden">
              <Link href={vacanciesHref} className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 dark:text-sky-400">
                <BriefcaseBusiness className="h-4 w-4" /> Ver vagas abertas
              </Link>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              {mode === 'register' ? 'Criar sua conta' : mode === 'reset' ? 'Redefinir senha' : 'Entrar na sua conta'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {mode === 'register'
                ? 'Leva menos de um minuto. Depois é só se candidatar.'
                : mode === 'reset'
                  ? 'Enviamos um código para o seu e-mail e você define a nova senha.'
                  : 'Acompanhe suas candidaturas, propostas e documentos.'}
            </p>

            {errorMessage && (
              <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 space-y-5">
              {mode !== 'reset' && (
                <>
                  <SocialLogin returnTo={returnTo} />
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                    {(['login', 'register'] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => onModeChange(item)}
                        className={
                          mode === item
                            ? 'rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50'
                            : 'rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:hover:text-slate-100'
                        }
                      >
                        {item === 'login' ? 'Já tenho conta' : 'Criar conta'}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {mode === 'register' && (
                <>
                  <Field label="Nome completo" value={form.name} onChange={(name) => onFormChange({ name })} autoComplete="name" required placeholder="Como você quer ser chamado" />
                  <Field label="Telefone" value={form.phone} onChange={(phone) => onFormChange({ phone })} autoComplete="tel" placeholder="(00) 00000-0000" hint="Usado pelo recrutador para falar com você." />
                </>
              )}

              <Field
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(email) => onFormChange({ email })}
                autoComplete="email"
                required
                placeholder="seu@email.com"
              />

              {mode === 'reset' && (
                <Field label="Código recebido" value={form.code} onChange={(code) => onFormChange({ code })} placeholder="6 dígitos" required />
              )}

              <div className="relative">
                <Field
                  label={mode === 'reset' ? 'Nova senha' : 'Senha'}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(password) => onFormChange({ password })}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  hint={mode === 'login' ? undefined : 'Mínimo de 6 caracteres.'}
                  onEnter={canSubmit && !loading ? onSubmit : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-[34px] rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {mode === 'reset' && (
                <Button variant="secondary" onClick={onRequestReset} disabled={loading || !form.email} className="w-full">
                  Enviar código para o meu e-mail
                </Button>
              )}

              {message && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
                  {message}
                </div>
              )}

              <Button onClick={onSubmit} disabled={loading || !canSubmit} className="h-11 w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? 'Aguarde...' : mode === 'register' ? 'Criar conta e entrar' : mode === 'reset' ? 'Redefinir e entrar' : 'Entrar'}
              </Button>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                {mode === 'login' && (
                  <button type="button" onClick={() => onModeChange('reset')} className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                    Esqueci minha senha
                  </button>
                )}
                {mode === 'reset' && (
                  <button type="button" onClick={() => onModeChange('login')} className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                    Voltar para o login
                  </button>
                )}
                <Link href={vacanciesHref} className="font-medium text-slate-500 hover:underline dark:text-slate-400">
                  Ver vagas abertas
                </Link>
              </div>

              {mode === 'register' && (
                <p className="text-xs leading-relaxed text-slate-400">
                  Ao criar sua conta, seus dados são tratados conforme a LGPD e usados apenas nos processos seletivos em que você se candidatar.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
