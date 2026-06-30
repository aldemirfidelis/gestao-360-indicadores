import QRCode from 'qrcode';

export type QrType = 'checkpoint' | 'form' | 'occurrence';

/**
 * Monta o deep-link que o QR carrega. Abre a página /scan resolvendo o token —
 * funciona tanto pelo leitor do app quanto pela câmera nativa do celular (que
 * apenas abre a URL).
 */
export function buildScanUrl(type: QrType, token: string): string {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://gestao360.org';
  return `${origin}/scan?type=${encodeURIComponent(type)}&token=${encodeURIComponent(token)}`;
}

/** Gera o dataURL (PNG) de um QR Code para o conteúdo informado. */
export async function qrDataUrl(content: string, opts?: { size?: number }): Promise<string> {
  return QRCode.toDataURL(content, {
    width: opts?.size ?? 320,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}
