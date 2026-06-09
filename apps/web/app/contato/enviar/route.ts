import { NextRequest, NextResponse } from 'next/server';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, message: 'Formulário inválido.' }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  if (typeof data.website === 'string' && data.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = String(data.name ?? '').trim();
  const company = String(data.company ?? '').trim();
  const email = String(data.email ?? '').trim().toLowerCase();
  const segment = String(data.segment ?? '').trim();
  const message = String(data.message ?? '').trim();
  const privacy = String(data.privacy ?? '').trim();

  if (!name || !company || !emailRegex.test(email) || !segment || message.length < 10 || privacy !== 'accepted') {
    return NextResponse.json({ ok: false, message: 'Preencha os campos obrigatórios e aceite a política de privacidade.' }, { status: 400 });
  }

  // Primeiro MVP de captura: registra um resumo operacional sem expor dados em codigo.
  // Integrações futuras podem encaminhar para CRM/e-mail usando variáveis de ambiente.
  console.info('public_contact_form_submit', {
    company,
    emailDomain: email.split('@')[1] ?? null,
    segment,
    hasPhone: Boolean(String(data.phone ?? '').trim()),
    submittedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
