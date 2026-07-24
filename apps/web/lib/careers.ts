export const CAREERS_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

export interface CareerPageConfig {
  published: boolean;
  showInGlobalPortal: boolean;
  template: 'MODERN' | 'CORPORATE' | 'MINIMAL' | string;
  heroAlignment: 'LEFT' | 'CENTER' | string;
  headline: string;
  subheadline: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  aboutTitle: string;
  aboutText: string | null;
  cultureTitle: string;
  cultureText: string | null;
  benefitsTitle: string;
  benefitsText: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  showAbout: boolean;
  showCulture: boolean;
  showBenefits: boolean;
}

export interface CareersCompany {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  careersPath: string;
  openVacancies?: number;
  primaryColor?: string;
}

export interface PublicVacancy {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  requirements?: string | null;
  benefits?: string | null;
  processSteps?: string | null;
  location: string | null;
  city: string | null;
  workMode: string | null;
  contractType: string | null;
  area: string | null;
  pcd: boolean;
  salary: string | null;
  publishedAt: string | null;
  closesAt: string | null;
  company?: CareersCompany;
}

export interface CareersFacets {
  cities: string[];
  workModes: string[];
  contractTypes: string[];
}

export interface CompanyCareersPayload {
  company: CareersCompany;
  careerPage: CareerPageConfig;
  vacancies: PublicVacancy[];
  facets: CareersFacets;
}

export interface GlobalCareersPayload {
  vacancies: Array<PublicVacancy & { company: CareersCompany }>;
  companies: CareersCompany[];
  facets: CareersFacets;
  total: number;
}

export function careersImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/careers/')) return `${CAREERS_API_URL}${value}`;
  return value;
}

export function companyCareersPath(slug: string | null | undefined) {
  return slug ? `/carreiras/${encodeURIComponent(slug)}` : '/carreiras';
}

export function publicVacancyPath(slug: string, companySlug: string | null | undefined) {
  const suffix = companySlug ? `?empresa=${encodeURIComponent(companySlug)}` : '';
  return `/carreiras/vagas/${encodeURIComponent(slug)}${suffix}`;
}

export function candidatePortalPath(companySlug?: string | null) {
  return companySlug ? `/candidato?empresa=${encodeURIComponent(companySlug)}` : '/candidato';
}

export const WORK_MODE_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  HIBRIDO: 'Híbrido',
  REMOTO: 'Remoto',
};

export const CONTRACT_LABEL: Record<string, string> = {
  CLT: 'CLT',
  PJ: 'Pessoa jurídica',
  TEMPORARIO: 'Temporário',
  ESTAGIO: 'Estágio',
  APRENDIZ: 'Jovem aprendiz',
};

export function labelOf(map: Record<string, string>, value: string | null | undefined) {
  return value ? map[value] ?? value : null;
}
