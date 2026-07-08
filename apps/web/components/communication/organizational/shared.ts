// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
import { toast } from 'sonner';

export type PostStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED' | 'CANCELLED' | 'REJECTED';
export type PostType = 'SIMPLE' | 'BANNER' | 'VIDEO' | 'POLL' | 'SURVEY' | 'CAMPAIGN';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | 'URGENT';
export type AudienceScope = 'ALL_COMPANY' | 'AREAS' | 'USERS' | 'MANAGERS' | 'DIRECTORS' | 'ACTIVE_USERS';

export interface AudienceRule {
  scope: AudienceScope;
  areaIds?: string[];
  userIds?: string[];
  roles?: string[];
  description?: string;
}

export interface ChannelConfig {
  platform?: boolean;
  homeCard?: boolean;
  topBanner?: boolean;
  mandatoryPopup?: boolean;
  myDay?: boolean;
  digitalBoard?: boolean;
  corporateTv?: boolean;
  kiosk?: boolean;
  qrCode?: boolean;
  email?: boolean;
  push?: boolean;
}

export interface CommunicationPost {
  id: string;
  title: string;
  subtitle?: string | null;
  content: string;
  type: PostType;
  category: string;
  priority: Priority;
  status: PostStatus;
  authorName: string;
  audience: AudienceRule;
  channels: ChannelConfig;
  publishAt?: string | null;
  expiresAt?: string | null;
  publishedAt?: string | null;
  coverImageUrl?: string | null;
  bannerUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  actionUrl?: string | null;
  actionLabel?: string | null;
  requiresReadConfirmation: boolean;
  requiresPollAnswer: boolean;
  requiresVideoCompletion: boolean;
  allowComments: boolean;
  allowReactions: boolean;
  isMandatory: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  qrCodeValue: string;
  poll?: {
    question: string;
    type: string;
    options: Array<{ id: string; label: string }>;
    dueAt?: string | null;
  } | null;
  receipts: Array<{ userId: string; userName: string; viewedAt: string; confirmedAt?: string | null }>;
  reactions: Array<{ id: string; type: string; userName: string }>;
  comments: Array<{ id: string; body: string; userName: string; createdAt: string }>;
  pollResponses: Array<{ id: string; answers: string[]; text?: string | null; userName: string }>;
  audienceSize: number;
  pendingReads: number;
  pendingConfirmations: number;
  readRate: number;
  confirmationRate: number;
  responseRate: number;
  reactionSummary: Record<string, number>;
  pollSummary?: Array<{ id: string; label: string; votes: number }> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationOverview {
  metrics: {
    publishedThisMonth: number;
    scheduled: number;
    drafts: number;
    pendingApproval: number;
    totalViews: number;
    readRate: number;
    confirmationRate: number;
    pollResponseRate: number;
    mandatoryPending: number;
    activeCampaigns: number;
    expired: number;
    critical: number;
    lowReadAudiences: Array<{ area: string; readRate: number }>;
    areasWithoutEngagement: number;
  };
  charts: {
    readByArea: Array<{ area: string; read: number; delivered: number; readRate: number }>;
    engagementByType: Array<{ type: string; posts: number; views: number; confirmations: number; responses: number }>;
    mostAccessed: CommunicationPost[];
    monthlyEvolution: Array<{ month: string; published: number; views: number; confirmations: number }>;
    pollResponses: Array<{ id: string; title: string; responses: number; audience: number }>;
    pendingByManager: Array<{ manager: string; area: string; pending: number }>;
  };
  myWall: {
    mandatoryPending: CommunicationPost[];
    recent: CommunicationPost[];
    campaigns: Campaign[];
    polls: CommunicationPost[];
    readHistory: CommunicationPost[];
  };
  team: {
    area: string | null;
    received: number;
    read: number;
    confirmed: number;
    pendingPeople: Array<{ id: string; name: string; pending: number }>;
  };
  posts: CommunicationPost[];
  campaigns: Campaign[];
  media: MediaItem[];
  templates: TemplateItem[];
  boards: BoardItem[];
  automations: AutomationRule[];
  audienceOptions: {
    users: Array<{ id: string; name: string; email: string; role: string; defaultNodeId?: string | null; areaName?: string | null }>;
    areas: Array<{ id: string; name: string; type: string }>;
  };
  integrationSignals: {
    redIndicators: number;
    overdueActions: number;
    docsNeedingRead: number;
    upcomingMeetings: number;
    suggestions: string[];
  };
  permissions: { canCreate: boolean; canApprove: boolean; canPublish: boolean };
  ai: { enabled: boolean; provider: string; model: string | null };
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  category: string;
  status: string;
  ownerName: string;
  startsAt?: string | null;
  endsAt?: string | null;
  postIds: string[];
}

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  category: string;
  tags: string[];
  url?: string | null;
  authorName: string;
  status: string;
  usageCount: number;
  createdAt: string;
}

export interface MediaUploadPayload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  name?: string;
  type?: 'IMAGE' | 'BANNER' | 'VIDEO';
  category?: string;
  tags?: string[];
  adjustments?: Record<string, unknown>;
}

export type UploadMediaFn = (payload: MediaUploadPayload) => Promise<MediaItem>;
export type AdjustedImageUpload = Omit<MediaUploadPayload, 'category' | 'tags'> & {
  type: 'IMAGE' | 'BANNER';
  adjustments: Record<string, unknown>;
};

export interface TemplateItem {
  id: string;
  name: string;
  type: PostType;
  category: string;
  tone: string;
  titlePattern: string;
  contentPattern: string;
}

export interface BoardItem {
  id: string;
  name: string;
  location: string;
  status: string;
  playlist: Array<{ postId: string; durationSeconds: number }>;
  publicPath: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  audience: string;
  channel: string;
  message: string;
  frequency: string;
  escalation: string;
  active: boolean;
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  SCHEDULED: 'Agendado',
  PUBLISHED: 'Publicado',
  EXPIRED: 'Expirado',
  ARCHIVED: 'Arquivado',
  CANCELLED: 'Cancelado',
  REJECTED: 'Reprovado',
};

export const TYPE_LABEL: Record<PostType, string> = {
  SIMPLE: 'Comunicado',
  BANNER: 'Banner',
  VIDEO: 'Vídeo',
  POLL: 'Enquete',
  SURVEY: 'Pesquisa',
  CAMPAIGN: 'Campanha',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
  URGENT: 'Urgente',
};

export const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: 'border-slate-200 bg-slate-50 text-slate-700',
  NORMAL: 'border-blue-200 bg-blue-50 text-blue-700',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-700',
  CRITICAL: 'border-red-200 bg-red-50 text-red-700',
  URGENT: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
};

export const CHANNELS: Array<{ key: keyof ChannelConfig; label: string }> = [
  { key: 'platform', label: 'Portal' },
  { key: 'homeCard', label: 'Home' },
  { key: 'topBanner', label: 'Banner topo' },
  { key: 'mandatoryPopup', label: 'Pop-up' },
  { key: 'myDay', label: 'Meu Dia' },
  { key: 'digitalBoard', label: 'Mural' },
  { key: 'corporateTv', label: 'TV' },
  { key: 'qrCode', label: 'QR Code' },
  { key: 'email', label: 'E-mail' },
  { key: 'push', label: 'Push' },
];

export const MAX_COMMUNICATION_MEDIA_BYTES = 6 * 1024 * 1024;
export const IMAGE_PRESETS = [
  { id: 'banner', label: 'Banner 16:9', width: 1600, height: 900, type: 'BANNER' as const },
  { id: 'card', label: 'Card 4:3', width: 1200, height: 900, type: 'IMAGE' as const },
  { id: 'square', label: 'Quadrado 1:1', width: 1080, height: 1080, type: 'IMAGE' as const },
  { id: 'story', label: 'Vertical 9:16', width: 1080, height: 1920, type: 'IMAGE' as const },
];

export const defaultForm = {
  title: '',
  subtitle: '',
  content: '',
  type: 'SIMPLE' as PostType,
  category: 'Institucional',
  priority: 'NORMAL' as Priority,
  status: 'DRAFT' as PostStatus,
  audienceScope: 'ALL_COMPANY' as AudienceScope,
  audienceAreaIds: [] as string[],
  audienceUserIds: [] as string[],
  publishAt: '',
  expiresAt: '',
  coverImageUrl: '',
  videoUrl: '',
  actionUrl: '',
  actionLabel: '',
  requiresReadConfirmation: false,
  requiresPollAnswer: false,
  requiresVideoCompletion: false,
  allowComments: true,
  allowReactions: true,
  isMandatory: false,
  isPinned: false,
  isFeatured: false,
  publicLinkEnabled: false,
  channels: {
    platform: true,
    myDay: true,
    qrCode: true,
    homeCard: false,
    topBanner: false,
    mandatoryPopup: false,
    digitalBoard: false,
    corporateTv: false,
    email: false,
    push: false,
  } as ChannelConfig,
  pollQuestion: '',
  pollOptions: 'Sim\nNão',
  pollDueAt: '',
};

export type CommunicationForm = typeof defaultForm;
export type BooleanFormKey =
  | 'isMandatory'
  | 'requiresReadConfirmation'
  | 'requiresVideoCompletion'
  | 'requiresPollAnswer'
  | 'allowComments'
  | 'allowReactions'
  | 'isPinned'
  | 'isFeatured';

export const BOOLEAN_FIELDS: Array<{ key: BooleanFormKey; label: string }> = [
  { key: 'isMandatory', label: 'Obrigatório' },
  { key: 'requiresReadConfirmation', label: 'Exigir ciência' },
  { key: 'requiresVideoCompletion', label: 'Vídeo completo' },
  { key: 'requiresPollAnswer', label: 'Exigir enquete' },
  { key: 'allowComments', label: 'Comentários' },
  { key: 'allowReactions', label: 'Reações' },
  { key: 'isPinned', label: 'Fixado' },
  { key: 'isFeatured', label: 'Destaque' },
];

export const COMMUNICATION_TABS = ['mural', 'central', 'criar', 'campanhas', 'midias', 'metricas', 'chat'] as const;
export type CommunicationTab = (typeof COMMUNICATION_TABS)[number];

export function isCommunicationTab(value: string | null): value is CommunicationTab {
  return Boolean(value && COMMUNICATION_TABS.includes(value as CommunicationTab));
}

export function toneClass(tone: string) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return tones[tone] ?? tones.slate;
}

export function isImageMedia(item: Pick<MediaItem, 'type' | 'url'>) {
  return item.type === 'IMAGE' || item.type === 'BANNER' || Boolean(item.url?.startsWith('data:image/'));
}

export function isVideoMedia(item: Pick<MediaItem, 'type' | 'url'>) {
  return item.type === 'VIDEO' || Boolean(item.url?.startsWith('data:video/'));
}

export function isPlayableVideoUrl(url: string) {
  return url.startsWith('data:video/') || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Nao foi possivel ler o arquivo.'));
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

export function inferVideoMime(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'webm') return 'video/webm';
  if (extension === 'ogg' || extension === 'ogv') return 'video/ogg';
  if (extension === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

export function adjustedImageName(fileName: string) {
  return `${fileName.replace(/\.[^.]+$/, '') || 'imagem'}-ajustada.jpg`;
}

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


export function formPayload(form: typeof defaultForm) {
  const pollOptions = form.pollOptions
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label) => ({ label }));
  return {
    title: form.title,
    subtitle: form.subtitle,
    content: form.content,
    type: form.type,
    category: form.category,
    priority: form.priority,
    status: form.status,
    audience: {
      scope: form.audienceScope,
      areaIds: form.audienceAreaIds,
      userIds: form.audienceUserIds,
      description: audienceLabel(form.audienceScope),
    },
    channels: form.channels,
    publishAt: form.publishAt || undefined,
    expiresAt: form.expiresAt || undefined,
    coverImageUrl: form.coverImageUrl || undefined,
    videoUrl: form.videoUrl || undefined,
    actionUrl: form.actionUrl || undefined,
    actionLabel: form.actionLabel || undefined,
    requiresReadConfirmation: form.requiresReadConfirmation,
    requiresPollAnswer: form.requiresPollAnswer,
    requiresVideoCompletion: form.requiresVideoCompletion,
    allowComments: form.allowComments,
    allowReactions: form.allowReactions,
    isMandatory: form.isMandatory,
    isPinned: form.isPinned,
    isFeatured: form.isFeatured,
    publicLinkEnabled: form.publicLinkEnabled,
    poll: form.pollQuestion
      ? {
          question: form.pollQuestion,
          type: 'SINGLE',
          options: pollOptions,
          dueAt: form.pollDueAt || undefined,
          showResults: true,
        }
      : undefined,
  };
}

export function audienceLabel(scope: AudienceScope) {
  const labels: Record<AudienceScope, string> = {
    ALL_COMPANY: 'Toda a empresa',
    AREAS: 'Áreas selecionadas',
    USERS: 'Usuários específicos',
    MANAGERS: 'Gestores',
    DIRECTORS: 'Diretoria',
    ACTIVE_USERS: 'Usuários ativos',
  };
  return labels[scope];
}

export function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

// ==========================================
// Central de Comunicação Organizacional
// Componente Dashboard de Alta Fidelidade Visual
// ==========================================

export interface KpiCardProps {
  title: string;
  value: string | number;
  change: string;
  color: 'emerald' | 'purple' | 'amber' | 'rose' | 'sky';
  icon: React.ComponentType<any>;
}

