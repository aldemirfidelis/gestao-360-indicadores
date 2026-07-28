import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { VacancyDetail } from '@/components/careers/vacancy-detail';
import { internalApiBaseUrl, publicSiteUrl } from '@/lib/internal-api';
import { CONTRACT_LABEL, WORK_MODE_LABEL, labelOf } from '@/lib/careers';
import { vacancyOgDescription } from '@/lib/recruitment/share';

interface VacancyPayload {
  company?: { name?: string | null; slug?: string | null };
  careerPage?: { bannerUrl?: string | null; logoUrl?: string | null };
  vacancy?: {
    title?: string | null;
    description?: string | null;
    city?: string | null;
    workMode?: string | null;
    contractType?: string | null;
  };
}

/**
 * Empresa a partir do subdomínio (`empresa.gestao360.org`).
 *
 * A API resolve a empresa pelo host OU por `?empresa=`, mas a busca aqui é
 * servidor-a-servidor e chega na API com host interno — então o subdomínio
 * precisa virar parâmetro explícito.
 */
function companyFromHost(host?: string | null): string | undefined {
  const parts = String(host ?? '').split(':')[0].split('.');
  if (parts.length >= 3 && !['www', 'app'].includes(parts[0])) return parts[0];
  return undefined;
}

/** A vaga muda pouco; robô de link bate várias vezes na mesma URL. */
const CACHE = { next: { revalidate: 3600 } } as const;

/**
 * Busca a vaga no servidor só para montar o cartão de compartilhamento.
 * Falha aqui nunca pode derrubar a página: sem dados, cai na metadata padrão.
 */
async function loadVacancy(slug: string, empresa?: string): Promise<VacancyPayload | null> {
  const base = internalApiBaseUrl();
  if (empresa) {
    const scoped = await fetchJson<VacancyPayload>(`${base}/careers/vacancies/${encodeURIComponent(slug)}?empresa=${encodeURIComponent(empresa)}`);
    if (scoped?.vacancy?.title) return scoped;
  }

  // Sem empresa (link direto, sem subdomínio) a rota por empresa devolve 404.
  // O catálogo global tem a vaga e a empresa dela — melhor um card correto do
  // que o genérico do site.
  const global = await fetchJson<{ vacancies?: Array<VacancyPayload['vacancy'] & { slug?: string; company?: VacancyPayload['company'] }> }>(
    `${base}/careers/global`,
  );
  const found = global?.vacancies?.find((item) => item?.slug === slug);
  if (!found) return null;
  const { company, ...vacancy } = found;

  // Descoberta a empresa, busca a marca dela: é o banner que faz o card sair
  // com cara de vaga em vez de link seco.
  const brand = company?.slug
    ? await fetchJson<{ careerPage?: VacancyPayload['careerPage'] }>(`${base}/careers/company?empresa=${encodeURIComponent(company.slug)}`)
    : null;
  return { company, vacancy, careerPage: brand?.careerPage };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, CACHE);
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Open Graph por vaga.
 *
 * É isto que faz o link compartilhado no LinkedIn/WhatsApp aparecer como uma
 * vaga de verdade — cargo, empresa, cidade e banner — em vez do card genérico
 * do site. O LinkedIn não aceita texto pré-preenchido: ele monta o card lendo
 * estas tags, então elas são a única forma de controlar o que aparece.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const host = (await headers()).get('host');
  const empresa = (typeof query.empresa === 'string' ? query.empresa : undefined) ?? companyFromHost(host);

  const data = await loadVacancy(slug, empresa);
  const vacancy = data?.vacancy;
  if (!vacancy?.title) {
    return { title: 'Vaga | Gestão 360', description: 'Confira esta oportunidade e candidate-se.' };
  }

  const companyName = data?.company?.name ?? null;
  const title = companyName ? `${vacancy.title} — ${companyName}` : vacancy.title;
  const description = vacancyOgDescription({
    title: vacancy.title,
    companyName,
    city: vacancy.city,
    workModeLabel: vacancy.workMode ? labelOf(WORK_MODE_LABEL, vacancy.workMode) : null,
    contractLabel: vacancy.contractType ? labelOf(CONTRACT_LABEL, vacancy.contractType) : null,
    description: vacancy.description,
  });

  const site = publicSiteUrl();
  // Sem `empresa` na URL, usa o slug da empresa descoberta: o link do card tem
  // de abrir a vaga com a empresa resolvida, senão a página não carrega.
  const companySlug = empresa ?? data?.company?.slug ?? null;
  const canonical = `${site}/carreiras/vagas/${encodeURIComponent(slug)}${companySlug ? `?empresa=${encodeURIComponent(companySlug)}` : ''}`;
  // O banner é servido pela API pública; precisa ser absoluto para o robô do
  // LinkedIn conseguir baixar.
  const banner = data?.careerPage?.bannerUrl ?? data?.careerPage?.logoUrl;
  const image = banner?.startsWith('/careers/') ? `${site}/api${banner}` : (banner ?? undefined);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      siteName: companyName ?? 'Gestão 360',
      locale: 'pt_BR',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function VacancyDetailPage() {
  return <VacancyDetail />;
}
