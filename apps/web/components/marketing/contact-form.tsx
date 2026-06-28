'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

const generalRequestTypes = ['Comercial', 'Suporte', 'SAC', 'Demonstração', 'Parceria', 'Outros'];
const supportRequestTypes = ['Suporte técnico', 'Dúvida de acesso', 'SAC', 'LGPD e privacidade'];

type ContactFormMode = 'general' | 'support' | 'trial';

interface ContactFormProps {
  compact?: boolean;
  mode?: ContactFormMode;
}

const modeContent: Record<ContactFormMode, { label: string; messageLabel: string; placeholder: string }> = {
  general: {
    label: 'Enviar mensagem',
    messageLabel: 'Mensagem',
    placeholder: 'Conte brevemente como podemos ajudar sua empresa.',
  },
  support: {
    label: 'Enviar para o suporte',
    messageLabel: 'Descreva sua dúvida',
    placeholder: 'Informe o que aconteceu, em qual tela e o resultado esperado. Não inclua senhas.',
  },
  trial: {
    label: 'Solicitar trial de 30 dias',
    messageLabel: 'Objetivo do trial',
    placeholder: 'Conte quais módulos deseja avaliar e o principal desafio da sua empresa.',
  },
};

export function ContactForm({ compact = false, mode = 'general' }: ContactFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const content = modeContent[mode];

  async function submit(formData: FormData) {
    setStatus('loading');
    setMessage('');
    const payload = Object.fromEntries(formData.entries());
    try {
      const res = await fetch('/contato/enviar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? 'Falha ao enviar mensagem.');
      setStatus('success');
      setMessage(
        mode === 'trial'
          ? 'Solicitação recebida. Nossa equipe comercial entrará em contato para organizar o trial.'
          : 'Mensagem enviada. A equipe do Gestão 360 retornará pelo canal informado.',
      );
      formRef.current?.reset();
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).dataLayer.push({
        event: 'contact_form_submit',
        page: window.location.pathname,
        requestType: payload.requestType,
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Não foi possível enviar o formulário.');
    }
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="grid gap-4"
      aria-label={mode === 'support' ? 'Formulário de suporte do Gestão 360' : mode === 'trial' ? 'Formulário de solicitação de trial do Gestão 360' : 'Formulário de contato do Gestão 360'}
    >
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className={compact ? 'grid gap-4' : 'grid gap-4 md:grid-cols-2'}>
        <Field label="Nome" name="name" required />
        <Field label="Empresa" name="company" required />
        <Field label="Cargo" name="role" />
        <Field label="E-mail corporativo" name="email" type="email" required />
        <Field label="Telefone" name="phone" type="tel" />
        {mode === 'trial' ? (
          <input type="hidden" name="requestType" value="Trial de 30 dias" />
        ) : (
          <label className="grid gap-1.5 text-sm font-medium text-slate-800">
            Tipo de solicitação
            <select name="requestType" required className="h-11 border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950">
              <option value="">Selecione</option>
              {(mode === 'support' ? supportRequestTypes : generalRequestTypes).map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-slate-800">
        {content.messageLabel}
        <textarea
          name="message"
          required
          minLength={10}
          rows={compact ? 4 : 5}
          className="border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950"
          placeholder={content.placeholder}
        />
      </label>
      <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
        <input name="privacy" value="accepted" type="checkbox" required className="mt-1 h-4 w-4 border-slate-300" />
        <span>
          Li e aceito a{' '}
          <Link href="/politica-de-privacidade" target="_blank" className="font-semibold text-emerald-700 hover:underline">
            Política de Privacidade
          </Link>
          . Os dados serão usados para atender esta solicitação.
        </span>
      </label>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex h-11 items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {content.label}
      </button>
      {message && (
        <div
          role="status"
          className={status === 'success' ? 'flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800' : 'border border-red-200 bg-red-50 p-3 text-sm text-red-800'}
        >
          {status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : null}
          {message}
        </div>
      )}
    </form>
  );
}

function Field({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="h-11 border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
      />
    </label>
  );
}
