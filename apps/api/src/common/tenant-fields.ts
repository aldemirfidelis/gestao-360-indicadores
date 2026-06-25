import { BadRequestException, ConflictException } from '@nestjs/common';
import { isReservedSubdomain } from './tenant-host';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const DOMAIN_RE = /^(?=.{1,255}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

export interface TenantFieldsInput {
  slug?: string | null;
  customDomain?: string | null;
}

export interface TenantFieldsChecks {
  /** true se já existe OUTRA empresa com este slug. */
  slugTaken: (slug: string) => Promise<boolean>;
  /** true se já existe OUTRA empresa com este domínio próprio. */
  customDomainTaken: (domain: string) => Promise<boolean>;
}

/**
 * Valida e normaliza `slug` (subdomínio) e `customDomain` (white-label) para
 * gravar na Company. Só processa campos presentes (≠ undefined); string vazia
 * limpa o valor (null). Garante formato, não-reservado e unicidade.
 *
 * Centraliza a regra usada pelas superfícies de cadastro de empresa
 * (platform e platform-admin) — ver [[multitenant-subdomain]].
 */
export async function prepareTenantFields(
  input: TenantFieldsInput,
  checks: TenantFieldsChecks,
): Promise<Partial<{ slug: string | null; customDomain: string | null }>> {
  const out: Partial<{ slug: string | null; customDomain: string | null }> = {};

  if (input.slug !== undefined) {
    const slug = (input.slug ?? '').trim().toLowerCase();
    if (!slug) out.slug = null;
    else {
      if (!SLUG_RE.test(slug)) throw new BadRequestException('Subdomínio inválido: use apenas letras minúsculas, números e hífens.');
      if (isReservedSubdomain(slug)) throw new BadRequestException('Este subdomínio é reservado.');
      if (await checks.slugTaken(slug)) throw new ConflictException('Já existe empresa com este subdomínio.');
      out.slug = slug;
    }
  }

  if (input.customDomain !== undefined) {
    const domain = (input.customDomain ?? '').trim().toLowerCase();
    if (!domain) out.customDomain = null;
    else {
      if (!DOMAIN_RE.test(domain)) throw new BadRequestException('Domínio próprio inválido (ex.: indicadores.suaempresa.com.br).');
      if (await checks.customDomainTaken(domain)) throw new ConflictException('Já existe empresa com este domínio próprio.');
      out.customDomain = domain;
    }
  }

  return out;
}
