/**
 * Deriva a paleta do shell (cabeçalho/menu) a partir de UMA cor escolhida pela
 * empresa. A dona da empresa escolhe a cor da marca; o resto — tom do menu,
 * borda, cor do texto — é calculado para o portal continuar legível, inclusive
 * quando a marca é clara (amarelo, laranja) ou muito saturada.
 */

export interface BrandPalette {
  /** Fundo do cabeçalho e do menu lateral. */
  shellBg: string;
  /** Fundo de campos/realces dentro do shell (um degrau do fundo). */
  shellBgSoft: string;
  /** Borda/divisórias do shell. */
  shellBorder: string;
  /** Cor do texto sobre o shell (claro ou escuro, conforme o contraste). */
  shellForeground: string;
  /** Texto secundário sobre o shell. */
  shellMuted: string;
  /** Cor da marca "pura", para realces pontuais. */
  brand: string;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value);
  if (!match) return null;
  const hex = match[1];
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return `#${full.toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex) ?? '#000000';
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Luminância relativa (WCAG) — decide entre texto claro e escuro. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const hsl = ({ h, s, l }: Hsl) => `${h} ${s}% ${l}%`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Monta a paleta do shell. `null` quando não há cor configurada — nesse caso o
 * portal segue com o azul padrão definido no CSS.
 */
export function brandPaletteFrom(color: string | null | undefined): BrandPalette | null {
  const hex = normalizeHex(color);
  if (!hex) return null;

  const base = hexToHsl(hex);
  // O shell é uma faixa sólida e grande: usar a cor da marca crua deixaria a tela
  // vibrante demais. Escurece o suficiente para o conteúdo continuar protagonista,
  // mas sem apagar a identidade (mantém matiz e boa parte da saturação).
  const isLightBrand = luminance(hex) > 0.45;
  const shellL = isLightBrand ? clamp(base.l - 46, 12, 26) : clamp(base.l <= 20 ? base.l : base.l - 18, 8, 22);
  const shellS = clamp(base.s, 12, 65);

  const shellBg: Hsl = { h: base.h, s: shellS, l: shellL };
  const shellBgSoft: Hsl = { h: base.h, s: shellS, l: clamp(shellL + 7, 10, 34) };
  const shellBorder: Hsl = { h: base.h, s: clamp(shellS - 6, 8, 55), l: clamp(shellL + 14, 14, 42) };

  // Contraste do texto medido contra o fundo REAL do shell, não contra a marca.
  const shellBgHex = hslToHex(shellBg);
  const light = luminance(shellBgHex) < 0.35;

  return {
    shellBg: hsl(shellBg),
    shellBgSoft: hsl(shellBgSoft),
    shellBorder: hsl(shellBorder),
    shellForeground: light ? '0 0% 100%' : `${base.h} 40% 12%`,
    shellMuted: light ? `${base.h} 18% 76%` : `${base.h} 25% 30%`,
    brand: hsl(base),
  };
}

function hslToHex({ h, s, l }: Hsl): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

/** Cores sugeridas na tela de identidade visual (atalho para o usuário). */
export const BRAND_COLOR_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Azul Gestão 360', value: '#0a1128' },
  { label: 'Azul corporativo', value: '#1b4b8f' },
  { label: 'Verde', value: '#1b6b45' },
  { label: 'Verde-oliva', value: '#4d6b1b' },
  { label: 'Vinho', value: '#7a1f2b' },
  { label: 'Laranja', value: '#c2570c' },
  { label: 'Roxo', value: '#4c2a86' },
  { label: 'Grafite', value: '#2b2f36' },
];
