import type { Metadata } from 'next';
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
 * Busca a vaga no servidor só para montar o cartão de compartilhamento.
 * Falha aqui nunca pode derrubar a página: sem dados, cai na metadata padrão.
 */
async function loadVacancy(slug: string, empresa?: string): Promise<VacancyPayload | null> {
  try {
    const query = empresa ? `?empresa=${encodeURIComponent(empresa)}` : '';
    const response = await fetch(`${internalApiBaseUrl()}/careers/vacancies/${encodeURIComponent(slug)}${query}`, {
      // A vaga muda pouco; revalidar de hora em hora evita ir à API a cada
      // rastreamento de link (LinkedIn, WhatsApp e Google batem várias vezes).
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    return (await response.json()) as VacancyPayload;
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
  const empresa = typeof query.empresa === 'string' ? query.empresa : undefined;

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
  const canonical = `${site}/carreiras/vagas/${encodeURIComponent(slug)}${empresa ? `?empresa=${encodeURIComponent(empresa)}` : ''}`;
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
