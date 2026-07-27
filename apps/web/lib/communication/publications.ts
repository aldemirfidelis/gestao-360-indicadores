// Tipos e helpers da Comunicação Interna (central administrativa + feed do
// colaborador). Substitui o antigo components/communication/organizational/shared.ts.

export type PublicationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type PublicationLayout = 'BANNER_WIDE' | 'FEED_CARD' | 'IMAGE_TEXT' | 'GALLERY' | 'TEXT_ONLY';

export type AudienceKind = 'ALL' | 'ORG_NODE' | 'JOB' | 'ROLE' | 'USER';

export interface AudienceSelection {
  kind: AudienceKind;
  refId?: string | null;
}

export interface PublicationMedia {
  id: string;
  url?: string | null;
  name: string;
  alt?: string | null;
  sizeBytes?: number | null;
}

export interface Publication {
  id: string;
  title: string;
  summary?: string | null;
  content?: string;
  status: PublicationStatus;
  statusLabel: string;
  layout: PublicationLayout;
  categoryId?: string | null;
  category: string;
  categoryColor?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  authorId: string;
  authorName: string;
  publishAt?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  isFeatured: boolean;
  isPinned: boolean;
  isImportant: boolean;
  requiresReadConfirmation: boolean;
  showInEmployeeFeed: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  allowAttachmentDownload: boolean;
  actionLabel?: string | null;
  actionUrl?: string | null;
  actionNewTab: boolean;
  audience: AudienceSelection[];
  audienceLabel: string;
  audienceTotal: number;
  views: number;
  confirmations: number;
  gallery: PublicationMedia[];
  attachments: PublicationMedia[];
  history?: Array<{ at: string; by: string; action: string; note?: string | null }>;
  approvalComment?: string | null;
  approverName?: string | null;
}

export interface PublicationOverview {
  metrics: { active: number; scheduled: number; viewsThisMonth: number; pendingConfirmations: number };
  recent: Publication[];
  scheduledPosts: Publication[];
  settings: { approvalRequired: boolean };
}

export interface PublicationCategory {
  id: string;
  name: string;
  color?: string | null;
  active: boolean;
  position: number;
}

export interface PublicationMetrics {
  post: { id: string; title: string; requiresReadConfirmation: boolean; publishedAt: string | null };
  summary: {
    audienceTotal: number;
    reached: number;
    views: number;
    notViewed: number;
    confirmations: number;
    pendingConfirmations: number;
    readRate: number;
    confirmationRate: number;
  };
  people: Array<{
    userId: string;
    name: string;
    email: string;
    area: string | null;
    viewedAt: string | null;
    confirmedAt: string | null;
  }>;
}

export interface AudienceOptions {
  total: number;
  orgNodes: Array<{ id: string; name: string; detail?: string | null; parentId?: string | null }>;
  jobs: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string; detail?: string | null }>;
  users: Array<{ id: string; name: string; detail?: string | null }>;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'IMAGE' | 'BANNER' | 'VIDEO' | 'PDF' | 'DOCUMENT' | 'ICON' | 'TEMPLATE';
  folder?: string | null;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  status: 'ACTIVE' | 'EXPIRED' | 'ARCHIVED';
  tags: string[];
  usageCount: number;
  createdAt: string;
  ratioWarning?: string | null;
}

// ---------------------------------------------------------------- feed

export interface FeedCard {
  id: string;
  title: string;
  summary?: string | null;
  layout: PublicationLayout;
  category: string;
  categoryColor?: string | null;
  categoryId?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  isFeatured: boolean;
  isImportant: boolean;
  requiresReadConfirmation: boolean;
  viewedAt?: string | null;
  confirmedAt?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  actionNewTab: boolean;
  status: PublicationStatus;
}

export interface FeedDetail extends FeedCard {
  content: string;
  allowAttachmentDownload: boolean;
  gallery: PublicationMedia[];
  attachments: PublicationMedia[];
}

export interface FeedResponse {
  items: FeedCard[];
  featured: FeedCard[];
  total: number;
  hasMore: boolean;
  counters: { pendingConfirmations: number; unread: number };
  categories: Array<{ id: string; name: string; color?: string | null; count: number }>;
}

// ---------------------------------------------------------------- rótulos

export const STATUS_LABEL: Record<PublicationStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_APPROVAL: 'Aguardando aprovação',
  REJECTED: 'Devolvida',
  SCHEDULED: 'Programada',
  PUBLISHED: 'Publicada',
  EXPIRED: 'Encerrada',
  ARCHIVED: 'Arquivada',
};

export const STATUS_STYLE: Record<PublicationStatus, string> = {
  DRAFT: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
  PENDING_APPROVAL: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400',
  REJECTED: 'border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400',
  SCHEDULED: 'border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400',
  PUBLISHED: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400',
  EXPIRED: 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400',
  ARCHIVED: 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400',
};

export const LAYOUT_OPTIONS: Array<{
  id: PublicationLayout;
  label: string;
  description: string;
  ratio: string;
  aspect: number;
}> = [
  { id: 'BANNER_WIDE', label: 'Banner horizontal', description: 'Faixa larga para destaque no topo', ratio: '16:9', aspect: 16 / 9 },
  { id: 'FEED_CARD', label: 'Card de feed', description: 'Formato vertical, ideal no celular', ratio: '4:5', aspect: 4 / 5 },
  { id: 'IMAGE_TEXT', label: 'Imagem e texto', description: 'Imagem quadrada com o texto ao lado', ratio: '1:1', aspect: 1 },
  { id: 'GALLERY', label: 'Galeria de imagens', description: 'Várias imagens na mesma publicação', ratio: '1:1', aspect: 1 },
  { id: 'TEXT_ONLY', label: 'Somente comunicado', description: 'Texto sem imagem de capa', ratio: '—', aspect: 0 },
];

export const IMAGE_PRESETS = [
  { id: 'banner', label: 'Banner 16:9', width: 1600, height: 900, type: 'BANNER' as const },
  { id: 'feed', label: 'Feed 4:5', width: 1080, height: 1350, type: 'IMAGE' as const },
  { id: 'square', label: 'Quadrado 1:1', width: 1080, height: 1080, type: 'IMAGE' as const },
];

export const MAX_MEDIA_BYTES = 6 * 1024 * 1024;

export function presetForLayout(layout: PublicationLayout) {
  if (layout === 'BANNER_WIDE') return IMAGE_PRESETS[0]!;
  if (layout === 'FEED_CARD') return IMAGE_PRESETS[1]!;
  return IMAGE_PRESETS[2]!;
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Cor de fundo suave a partir da cor da categoria (fallback neutro). */
export function categoryStyle(color?: string | null) {
  if (!color) return { backgroundColor: 'rgb(100 116 139 / 0.12)', color: 'rgb(71 85 105)' };
  return { backgroundColor: `${color}1f`, color };
}

// ---------------------------------------------------------------- arquivos

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

export function stripDataUrl(dataUrl: string) {
  return dataUrl.includes(',') ? dataUrl.split(',').pop() ?? '' : dataUrl;
}

export function base64ByteSize(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Desenha a imagem recortada no canvas, cobrindo o formato escolhido. */
export function drawAdjustedImage(
  canvas: HTMLCanvasElement | null,
  image: HTMLImageElement | null,
  width: number,
  height: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
) {
  if (!canvas || !image) return;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const dx = (width - drawWidth) / 2 + (offsetX / 100) * width;
  const dy = (height - drawHeight) / 2 + (offsetY / 100) * height;
  context.drawImage(image, dx, dy, drawWidth, drawHeight);
}

export function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

/** Converte ISO -> valor aceito por <input type="datetime-local">. */
export function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
