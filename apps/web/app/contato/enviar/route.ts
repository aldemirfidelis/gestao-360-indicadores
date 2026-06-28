import { NextRequest, NextResponse } from 'next/server';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function apiBaseUrl(): string {
  const configured =
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3333/api';

  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/$/, '');

  // No Docker, o serviço web alcança a API pelo nome interno `api`.
  if (process.env.NODE_ENV === 'production') {
    return `http://api:3333${configured.startsWith('/') ? configured : `/${configured}`}`.replace(/\/$/, '');
  }

  return `http://localhost:3333${configured.startsWith('/') ? configured : `/${configured}`}`.replace(/\/$/, '');
}

function responseMessage(status: number): string {
  if (status === 429) return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.';
  if (status >= 500) return 'O envio está temporariamente indisponível. Tente novamente em alguns minutos.';
  return 'Revise os dados informados e tente novamente.';
}

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
  const requestType = String(data.requestType ?? '').trim();
  const message = String(data.message ?? '').trim();
  const privacy = String(data.privacy ?? '').trim();

  if (
    name.length < 2 ||
    name.length > 120 ||
    company.length < 2 ||
    company.length > 180 ||
    !emailRegex.test(email) ||
    email.length > 180 ||
    !requestType ||
    requestType.length > 60 ||
    message.length < 10 ||
    message.length > 5000 ||
    privacy !== 'accepted'
  ) {
    return NextResponse.json({ ok: false, message: 'Preencha os campos obrigatórios e aceite a política de privacidade.' }, { status: 400 });
  }

  const payload = {
    name,
    company,
    role: String(data.role ?? '').trim().slice(0, 120),
    email,
    phone: String(data.phone ?? '').trim().slice(0, 40),
    requestType,
    message,
    privacy,
    website: '',
  };

  try {
    const response = await fetch(`${apiBaseUrl()}/public/contact`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(req.headers.get('x-forwarded-for')
          ? { 'x-forwarded-for': req.headers.get('x-forwarded-for') as string }
          : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: responseMessage(response.status) },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Não foi possível conectar ao atendimento. Tente novamente em alguns minutos.' },
      { status: 503 },
    );
  }
}
