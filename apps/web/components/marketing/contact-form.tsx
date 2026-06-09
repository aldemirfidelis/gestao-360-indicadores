'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

const segments = ['Indústria', 'Agronegócio', 'Alimentos e bebidas', 'Serviços', 'Gestão corporativa', 'Outro'];

export function ContactForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

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
      setMessage('Mensagem recebida. A equipe do Gestão 360 retornará pelo canal informado.');
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).dataLayer.push({
        event: 'contact_form_submit',
        page: window.location.pathname,
        segment: payload.segment,
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Não foi possível enviar o formulário.');
    }
  }

  return (
    <form action={submit} className="grid gap-4" aria-label="Formulário comercial do Gestão 360">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className={compact ? 'grid gap-4' : 'grid gap-4 md:grid-cols-2'}>
        <Field label="Nome" name="name" required />
        <Field label="Empresa" name="company" required />
        <Field label="Cargo" name="role" />
        <Field label="E-mail corporativo" name="email" type="email" required />
        <Field label="Telefone" name="phone" type="tel" />
        <label className="grid gap-1.5 text-sm font-medium text-slate-800">
          Segmento
          <select name="segment" required className="h-11 border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950">
            <option value="">Selecione</option>
            {segments.map((segment) => <option key={segment} value={segment}>{segment}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-slate-800">
        Mensagem
        <textarea
          name="message"
          required
          minLength={10}
          rows={compact ? 4 : 5}
          className="border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950"
          placeholder="Conte brevemente o que você deseja melhorar na gestão da empresa."
        />
      </label>
      <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
        <input name="privacy" value="accepted" type="checkbox" required className="mt-1 h-4 w-4 border-slate-300" />
        <span>
          Li e aceito a política de privacidade. Os dados serão usados para retorno comercial e não serão vendidos.
        </span>
      </label>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex h-11 items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Enviar mensagem
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
