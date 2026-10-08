'use client';
import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';

export function DemoAccess() {
  const { loginDemo } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function enter() {
    setBusy(true); setError('');
    try { await loginDemo(); }
    catch { setError('Não foi possível abrir a demonstração agora. Tente novamente em instantes.'); setBusy(false); }
  }
  return <div className="mx-auto max-w-xl rounded-2xl border border-sky-200 bg-white p-8 shadow-sm">
    <h2 className="text-2xl font-semibold text-slate-950">Empresa Demonstração</h2>
    <p className="mt-3 leading-7 text-slate-600">Explore o BSC, indicadores, resultados, planos de ação, reuniões e a gestão de prêmio com dados fictícios preenchidos.</p>
    <p className="mt-3 text-sm text-slate-600">O acesso é somente para consulta e dura uma hora. Não é necessário informar e-mail ou senha.</p>
    <button type="button" disabled={busy} onClick={() => void enter()} className="mt-6 w-full rounded-xl bg-sky-700 px-6 py-4 font-semibold text-white hover:bg-sky-800 disabled:opacity-60">{busy ? 'Abrindo demonstração…' : 'Acesse a Demonstração'}</button>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
  </div>;
}
