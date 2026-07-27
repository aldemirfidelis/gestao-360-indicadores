/**
 * Link de conversa no WhatsApp a partir de um telefone cadastrado.
 *
 * Os telefones no sistema são digitados por pessoas: chegam com máscara,
 * espaço, traço, parênteses, com ou sem DDI. O `wa.me` só aceita dígitos em
 * formato internacional, então normalizamos antes — e devolvemos `null` quando
 * o número não dá para aproveitar, para a interface não oferecer um botão que
 * abriria o WhatsApp num número inválido.
 */

/** DDI padrão quando o número vem só com DDD (caso da maioria dos cadastros). */
const DEFAULT_COUNTRY_CODE = '55';

/**
 * Converte o telefone para o formato do wa.me (só dígitos, com DDI).
 * Retorna `null` se o número for curto demais para ser um telefone real.
 */
export function normalizeWhatsappNumber(phone?: string | null, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return null;

  // Já veio com DDI do Brasil: 55 + DDD (2) + número (8 ou 9).
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;

  // DDD + número, sem DDI — o caso mais comum nos cadastros brasileiros.
  if (digits.length === 10 || digits.length === 11) return `${countryCode}${digits}`;

  // Número internacional já completo (outro DDI).
  if (digits.length >= 12 && digits.length <= 15) return digits;

  // Curto demais: provavelmente ramal ou cadastro incompleto.
  return null;
}

/** URL de conversa; `null` quando o telefone não serve. */
export function whatsappLink(phone?: string | null, message?: string): string | null {
  const number = normalizeWhatsappNumber(phone);
  if (!number) return null;
  const text = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : '';
  return `https://wa.me/${number}${text}`;
}
