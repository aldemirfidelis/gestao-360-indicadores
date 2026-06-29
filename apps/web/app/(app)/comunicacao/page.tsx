'use client';

import Link from 'next/link';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Crop,
  FileBarChart,
  FileText,
  FileUp,
  Film,
  HelpCircle,
  Image as ImageIcon,
  ImagePlus,
  Link2,
  Megaphone,
  MessageCircle,
  MessageSquare,
  PlaySquare,
  Plus,
  QrCode,
  Send,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  Users,
  Video,
  Vote,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/shell/page-header';
import { ConversationList } from '@/components/communication/chat/conversation-list';
import { ChatPanel } from '@/components/communication/chat/chat-panel';
import { ContactDetails } from '@/components/communication/chat/contact-details';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils';
import type { ConversationSummary } from '@/lib/communication/types';

type PostStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED' | 'CANCELLED' | 'REJECTED';
type PostType = 'SIMPLE' | 'BANNER' | 'VIDEO' | 'POLL' | 'SURVEY' | 'CAMPAIGN';
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | 'URGENT';
type AudienceScope = 'ALL_COMPANY' | 'AREAS' | 'USERS' | 'MANAGERS' | 'DIRECTORS' | 'ACTIVE_USERS';

interface AudienceRule {
  scope: AudienceScope;
  areaIds?: string[];
  userIds?: string[];
  roles?: string[];
  description?: string;
}

interface ChannelConfig {
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

interface CommunicationPost {
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

interface CommunicationOverview {
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

interface Campaign {
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

interface MediaItem {
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

interface MediaUploadPayload {
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

type UploadMediaFn = (payload: MediaUploadPayload) => Promise<MediaItem>;
type AdjustedImageUpload = Omit<MediaUploadPayload, 'category' | 'tags'> & {
  type: 'IMAGE' | 'BANNER';
  adjustments: Record<string, unknown>;
};

interface TemplateItem {
  id: string;
  name: string;
  type: PostType;
  category: string;
  tone: string;
  titlePattern: string;
  contentPattern: string;
}

interface BoardItem {
  id: string;
  name: string;
  location: string;
  status: string;
  playlist: Array<{ postId: string; durationSeconds: number }>;
  publicPath: string;
}

interface AutomationRule {
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

const STATUS_LABEL: Record<PostStatus, string> = {
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

const TYPE_LABEL: Record<PostType, string> = {
  SIMPLE: 'Comunicado',
  BANNER: 'Banner',
  VIDEO: 'Vídeo',
  POLL: 'Enquete',
  SURVEY: 'Pesquisa',
  CAMPAIGN: 'Campanha',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
  URGENT: 'Urgente',
};

const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: 'border-slate-200 bg-slate-50 text-slate-700',
  NORMAL: 'border-blue-200 bg-blue-50 text-blue-700',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-700',
  CRITICAL: 'border-red-200 bg-red-50 text-red-700',
  URGENT: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
};

const CHANNELS: Array<{ key: keyof ChannelConfig; label: string }> = [
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

const MAX_COMMUNICATION_MEDIA_BYTES = 6 * 1024 * 1024;
const IMAGE_PRESETS = [
  { id: 'banner', label: 'Banner 16:9', width: 1600, height: 900, type: 'BANNER' as const },
  { id: 'card', label: 'Card 4:3', width: 1200, height: 900, type: 'IMAGE' as const },
  { id: 'square', label: 'Quadrado 1:1', width: 1080, height: 1080, type: 'IMAGE' as const },
  { id: 'story', label: 'Vertical 9:16', width: 1080, height: 1920, type: 'IMAGE' as const },
];

const defaultForm = {
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

type CommunicationForm = typeof defaultForm;
type BooleanFormKey =
  | 'isMandatory'
  | 'requiresReadConfirmation'
  | 'requiresVideoCompletion'
  | 'requiresPollAnswer'
  | 'allowComments'
  | 'allowReactions'
  | 'isPinned'
  | 'isFeatured';

const BOOLEAN_FIELDS: Array<{ key: BooleanFormKey; label: string }> = [
  { key: 'isMandatory', label: 'Obrigatório' },
  { key: 'requiresReadConfirmation', label: 'Exigir ciência' },
  { key: 'requiresVideoCompletion', label: 'Vídeo completo' },
  { key: 'requiresPollAnswer', label: 'Exigir enquete' },
  { key: 'allowComments', label: 'Comentários' },
  { key: 'allowReactions', label: 'Reações' },
  { key: 'isPinned', label: 'Fixado' },
  { key: 'isFeatured', label: 'Destaque' },
];

const COMMUNICATION_TABS = ['mural', 'central', 'criar', 'campanhas', 'midias', 'metricas', 'chat'] as const;
type CommunicationTab = (typeof COMMUNICATION_TABS)[number];

function isCommunicationTab(value: string | null): value is CommunicationTab {
  return Boolean(value && COMMUNICATION_TABS.includes(value as CommunicationTab));
}

export default function ComunicacaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const requestedConversation = searchParams.get('c');
  const requestedUser = searchParams.get('to');
  const requestedPost = searchParams.get('post');
  const requestedTab = searchParams.get('tab');
  const startedFor = useRef<string | null>(null);
  const initialTab = requestedConversation || requestedUser ? 'chat' : isCommunicationTab(requestedTab) ? requestedTab : 'mural';
  const [tab, setTab] = useState<CommunicationTab>(initialTab);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(requestedPost);
  const [form, setForm] = useState(defaultForm);
  const [aiPrompt, setAiPrompt] = useState('');
  const [commentText, setCommentText] = useState('');
  const [pollAnswer, setPollAnswer] = useState('');
  const [channelFilter, setChannelFilter] = useState('Todos os canais');
  const [detailPostOpen, setDetailPostOpen] = useState(false);

  const overview = useQuery<CommunicationOverview>({
    queryKey: ['communication-organizational'],
    queryFn: () => api('/communication/organizational'),
  });

  const conversations = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: () => api('/communication/conversations'),
    refetchInterval: tab === 'chat' ? 30_000 : false,
  });

  const startDirect = useMutation({
    mutationFn: (userId: string) =>
      api<ConversationSummary>('/communication/conversations/direct', {
        method: 'POST',
        json: { userId },
      }),
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      router.replace(`/comunicacao?c=${conversation.id}`);
      setTab('chat');
    },
    onError: (e: any) => {
      toast.error(e?.message ?? 'Não foi possível iniciar a conversa');
      router.replace('/comunicacao');
    },
  });

  useEffect(() => {
    if (!requestedUser || startedFor.current === requestedUser) return;
    startedFor.current = requestedUser;
    startDirect.mutate(requestedUser);
  }, [requestedUser, startDirect]);

  useEffect(() => {
    if (requestedPost) {
      setSelectedPostId(requestedPost);
      setTab('mural');
    }
  }, [requestedPost]);

  useEffect(() => {
    if (requestedConversation || requestedUser) {
      setTab('chat');
      return;
    }
    if (isCommunicationTab(requestedTab)) setTab(requestedTab);
  }, [requestedConversation, requestedUser, requestedTab]);

  const createPost = useMutation({
    mutationFn: () => api('/communication/organizational/posts', { method: 'POST', json: formPayload(form) }),
    onSuccess: async () => {
      toast.success('Comunicado salvo');
      setForm(defaultForm);
      await overview.refetch();
      setTab('central');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PostStatus }) =>
      api(`/communication/organizational/posts/${id}/status`, { method: 'POST', json: { status } }),
    onSuccess: async () => {
      toast.success('Status atualizado');
      await overview.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markRead = useMutation({
    mutationFn: ({ id, confirmed }: { id: string; confirmed: boolean }) =>
      api(`/communication/organizational/posts/${id}/read`, {
        method: 'POST',
        json: { confirmed, channel: 'Portal web', device: 'browser' },
      }),
    onSuccess: async () => {
      toast.success('Ciência registrada');
      await overview.refetch();
    },
  });

  const react = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      api(`/communication/organizational/posts/${id}/reactions`, { method: 'POST', json: { type } }),
    onSuccess: () => overview.refetch(),
  });

  const addComment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api(`/communication/organizational/posts/${id}/comments`, { method: 'POST', json: { body } }),
    onSuccess: async () => {
      setCommentText('');
      await overview.refetch();
    },
  });

  const respondPoll = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      api(`/communication/organizational/posts/${id}/poll-responses`, { method: 'POST', json: { answers: [answer] } }),
    onSuccess: async () => {
      setPollAnswer('');
      toast.success('Resposta registrada');
      await overview.refetch();
    },
  });

  const generateAi = useMutation({
    mutationFn: () =>
      api<any>('/communication/organizational/ai/draft', {
        method: 'POST',
        json: {
          objective: aiPrompt || form.title || 'Comunicado interno',
          audience: audienceLabel(form.audienceScope),
          tone: 'corporativo, simples e acessível',
          sourceText: form.content,
          type: form.type,
        },
      }),
    onSuccess: (data) => {
      const draft = data.draft ?? {};
      setForm((current) => ({
        ...current,
        title: draft.title ?? current.title,
        subtitle: draft.subtitle ?? current.subtitle,
        content: draft.fullVersion ?? draft.shortVersion ?? current.content,
      }));
      toast.success('Rascunho gerado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCampaign = useMutation({
    mutationFn: (payload: any) => api('/communication/organizational/campaigns', { method: 'POST', json: payload }),
    onSuccess: () => overview.refetch(),
  });

  const createMedia = useMutation({
    mutationFn: (payload: any) => api('/communication/organizational/media', { method: 'POST', json: payload }),
    onSuccess: async () => {
      toast.success('Mídia adicionada');
      await overview.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadMedia = useMutation<MediaItem, Error, MediaUploadPayload>({
    mutationFn: (payload) => api<MediaItem>('/communication/organizational/media/upload', { method: 'POST', json: payload }),
    onSuccess: () => overview.refetch(),
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedId = useMemo(() => {
    const list = conversations.data ?? [];
    if (requestedConversation && list.some((c) => c.id === requestedConversation)) return requestedConversation;
    return list[0]?.id ?? null;
  }, [conversations.data, requestedConversation]);

  const selectedConversation = useMemo(
    () => (conversations.data ?? []).find((c) => c.id === selectedId) ?? null,
    [conversations.data, selectedId],
  );
  const unread = (conversations.data ?? []).reduce((sum, c) => sum + c.unread, 0);
  const data = overview.data;
  const posts = data?.posts ?? [];
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? data?.myWall?.mandatoryPending?.[0] ?? data?.myWall?.recent?.[0] ?? null;
  const canCreate = hasPermission(['communication:create', 'communication:manage', 'communication:attachments']);

  return (
    <div className="space-y-4">
      {tab === 'mural' ? (
        <CommunicationDashboardView
          data={data}
          loading={overview.isLoading}
          channelFilter={channelFilter}
          setChannelFilter={setChannelFilter}
          setTab={setTab}
          onCreatePreset={(preset) => {
            setForm({ ...defaultForm, ...preset, channels: { ...defaultForm.channels, ...(preset.channels ?? {}) } });
            setTab('criar');
          }}
          onSelectPost={(id) => {
            setSelectedPostId(id);
            setDetailPostOpen(true);
          }}
          unread={unread}
          conversationCount={conversations.data?.length ?? 0}
          onMessageUser={(id) => startDirect.mutate(id)}
          canCreate={canCreate}
        />
      ) : (
        <>
          <PageHeader
            eyebrow="Comunicação"
            tone="view"
            title="Comunicação Organizacional"
            description="Comunicados, campanhas, mural, pesquisas, confirmações e chat corporativo."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{data?.metrics?.mandatoryPending ?? 0} ciência(s) pendente(s)</Badge>
                <Badge variant="outline">{unread} mensagem(ns)</Badge>
                <Button asChild variant="outline">
                  <Link href="/pessoas">
                    <Users className="mr-2 h-4 w-4" />
                    Pessoas
                  </Link>
                </Button>
                {canCreate && (
                  <Button onClick={() => setTab('criar')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo comunicado
                  </Button>
                )}
              </div>
            }
          />

          <Dashboard metrics={data?.metrics} loading={overview.isLoading} />

          <Tabs value={tab} onValueChange={(value) => isCommunicationTab(value) && setTab(value)} className="space-y-4">
            {/* abas removidas pois já estão no menu lateral */}

            <TabsContent value="mural" className="hidden" />

        <TabsContent value="central" className="space-y-4">
          <CommunicationTable
            posts={posts}
            onSelect={(post) => {
              setSelectedPostId(post.id);
              setTab('mural');
            }}
            onStatus={(id, status) => changeStatus.mutate({ id, status })}
          />
        </TabsContent>

        <TabsContent value="criar" className="space-y-4">
          <CreatePostForm
            form={form}
            setForm={setForm}
            overview={data}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            generateAi={() => generateAi.mutate()}
            saving={createPost.isPending}
            uploadMedia={uploadMedia.mutateAsync}
            uploadingMedia={uploadMedia.isPending}
            onSubmit={() => createPost.mutate()}
          />
        </TabsContent>

        <TabsContent value="campanhas" className="space-y-4">
          <CampaignsPanel campaigns={data?.campaigns ?? []} createCampaign={(payload) => createCampaign.mutate(payload)} />
        </TabsContent>

        <TabsContent value="midias" className="space-y-4">
          <MediaPanel
            media={data?.media ?? []}
            createMedia={(payload) => createMedia.mutateAsync(payload)}
            uploadMedia={uploadMedia.mutateAsync}
            uploadingMedia={uploadMedia.isPending}
          />
        </TabsContent>

        <TabsContent value="metricas" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <EngagementCharts data={data} />
            <IntegrationSignals data={data} />
          </div>
          <MetricsPanel data={data} />
          <PostGrid posts={data?.charts?.mostAccessed ?? []} onSelect={(post) => { setSelectedPostId(post.id); setTab('mural'); }} />
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <ChatWorkspace
            conversations={conversations.data ?? []}
            selectedId={selectedId}
            selected={selectedConversation}
            isLoading={conversations.isLoading || startDirect.isPending}
            onSelect={(id) => router.replace(`/comunicacao?c=${id}`)}
          />
        </TabsContent>
      </Tabs>
        </>
      )}

      {detailPostOpen && selectedPost && (
        <Dialog open={detailPostOpen} onOpenChange={setDetailPostOpen}>
          <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh] bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle>Detalhes do Comunicado</DialogTitle>
            </DialogHeader>
            <div className="p-2">
              <PostDetail
                post={selectedPost}
                markRead={(confirmed) => selectedPost && markRead.mutate({ id: selectedPost.id, confirmed })}
                react={(type) => selectedPost && react.mutate({ id: selectedPost.id, type })}
                commentText={commentText}
                setCommentText={setCommentText}
                submitComment={() => selectedPost && commentText.trim() && addComment.mutate({ id: selectedPost.id, body: commentText })}
                pollAnswer={pollAnswer}
                setPollAnswer={setPollAnswer}
                submitPoll={() => selectedPost && pollAnswer && respondPoll.mutate({ id: selectedPost.id, answer: pollAnswer })}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setDetailPostOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Dashboard({ metrics, loading }: { metrics?: CommunicationOverview['metrics']; loading: boolean }) {
  const items = [
    { label: 'Publicados no mês', value: metrics?.publishedThisMonth ?? 0, detail: `${metrics?.scheduled ?? 0} agendados`, icon: Megaphone, tone: 'blue' },
    { label: 'Rascunhos', value: metrics?.drafts ?? 0, detail: `${metrics?.pendingApproval ?? 0} aguardando aprovação`, icon: FileText, tone: 'slate' },
    { label: 'Visualizações', value: metrics?.totalViews ?? 0, detail: `Leitura ${formatPercent(metrics?.readRate ?? 0)}`, icon: BookOpenCheck, tone: 'green' },
    { label: 'Confirmação', value: formatPercent(metrics?.confirmationRate ?? 0), detail: `${metrics?.mandatoryPending ?? 0} obrigatórios pendentes`, icon: ClipboardCheck, tone: 'amber' },
    { label: 'Enquetes', value: formatPercent(metrics?.pollResponseRate ?? 0), detail: 'taxa de resposta', icon: Vote, tone: 'violet' },
    { label: 'Críticos', value: metrics?.critical ?? 0, detail: `${metrics?.expired ?? 0} vencidos`, icon: AlertTriangle, tone: 'red' },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                <p className="mt-2 break-words text-2xl font-semibold">{loading ? '-' : item.value}</p>
              </div>
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', toneClass(item.tone))}>
                <item.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 break-words text-xs text-muted-foreground">{loading ? 'Carregando...' : item.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EngagementCharts({ data }: { data?: CommunicationOverview }) {
  const readByArea = data?.charts?.readByArea?.slice(0, 8) ?? [];
  const typeData = data?.charts?.engagementByType ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engajamento</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={readByArea} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="area" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatNumber(Number(value))} />
              <Bar dataKey="read" fill="#2563eb" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeData} margin={{ left: -16, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="type" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="views" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Bar dataKey="responses" fill="#d97706" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationSignals({ data }: { data?: CommunicationOverview }) {
  const signals = data?.integrationSignals;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações do Gestão 360</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <SmallFact label="Indicadores vermelhos" value={signals?.redIndicators ?? 0} />
          <SmallFact label="Ações atrasadas" value={signals?.overdueActions ?? 0} />
          <SmallFact label="Ciência documental" value={signals?.docsNeedingRead ?? 0} />
          <SmallFact label="Reuniões futuras" value={signals?.upcomingMeetings ?? 0} />
        </div>
        <div className="space-y-2">
          {(signals?.suggestions ?? []).map((item) => (
            <div key={item} className="flex min-w-0 gap-2 rounded-md border p-3 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="break-words">{item}</span>
            </div>
          ))}
          {!signals?.suggestions?.length && <p className="text-sm text-muted-foreground">Sem sugestões automáticas no momento.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PostGrid({ posts, onSelect }: { posts: CommunicationPost[]; onSelect: (post: CommunicationPost) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comunicados mais acessados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {posts.map((post) => <PostCard key={post.id} post={post} onClick={() => onSelect(post)} />)}
          {posts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comunicado publicado ainda.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({ post, onClick }: { post: CommunicationPost; onClick: () => void }) {
  return (
    <button onClick={onClick} className="min-w-0 rounded-md border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{post.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{post.category}</p>
        </div>
        <PriorityBadge priority={post.priority} />
      </div>
      <p className="mt-3 line-clamp-3 break-words text-xs text-muted-foreground">{post.subtitle || post.content}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <SmallFact label="Leitura" value={formatPercent(post.readRate)} />
        <SmallFact label="Ciência" value={formatPercent(post.confirmationRate)} />
        <SmallFact label="Pend." value={post.pendingReads} />
      </div>
    </button>
  );
}

function WallList({ title, posts, onSelect, horizontal = false }: { title: string; posts: CommunicationPost[]; onSelect: (id: string) => void; horizontal?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(horizontal ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4' : 'space-y-3')}>
          {posts.map((post) => (
            <button key={post.id} onClick={() => onSelect(post.id)} className="w-full min-w-0 rounded-md border p-3 text-left hover:bg-muted/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{post.title}</p>
                  <p className="text-xs text-muted-foreground">{TYPE_LABEL[post.type]} · {post.category}</p>
                </div>
                {post.isMandatory && <Badge variant="outline">Obrigatório</Badge>}
              </div>
            </button>
          ))}
          {posts.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PostDetail({
  post,
  markRead,
  react,
  commentText,
  setCommentText,
  submitComment,
  pollAnswer,
  setPollAnswer,
  submitPoll,
}: {
  post: CommunicationPost | null;
  markRead: (confirmed: boolean) => void;
  react: (type: string) => void;
  commentText: string;
  setCommentText: (value: string) => void;
  submitComment: () => void;
  pollAnswer: string;
  setPollAnswer: (value: string) => void;
  submitPoll: () => void;
}) {
  if (!post) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum comunicado selecionado.</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        {post.bannerUrl || post.coverImageUrl ? (
          <div className="h-48 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${post.bannerUrl || post.coverImageUrl})` }} />
        ) : (
          <div className="grid h-32 place-items-center rounded-md bg-gradient-to-br from-blue-50 to-emerald-50 text-primary">
            <Megaphone className="h-10 w-10" />
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority={post.priority} />
              <Badge variant="secondary">{STATUS_LABEL[post.status]}</Badge>
              <Badge variant="outline">{TYPE_LABEL[post.type]}</Badge>
            </div>
            <h2 className="mt-3 break-words text-2xl font-semibold">{post.title}</h2>
            {post.subtitle && <p className="mt-1 break-words text-muted-foreground">{post.subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => markRead(false)} variant="outline">
              <BookOpenCheck className="mr-2 h-4 w-4" />
              Marcar lido
            </Button>
            {(post.requiresReadConfirmation || post.isMandatory) && (
              <Button onClick={() => markRead(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Li e estou ciente
              </Button>
            )}
          </div>
        </div>
        {post.videoUrl && isPlayableVideoUrl(post.videoUrl) && (
          <video className="max-h-[420px] w-full rounded-md bg-black" controls preload="metadata" poster={post.thumbnailUrl ?? post.coverImageUrl ?? undefined}>
            <source src={post.videoUrl} />
          </video>
        )}
        {post.videoUrl && (
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PlaySquare className="h-4 w-4" />
              Vídeo vinculado
            </div>
            <a href={post.videoUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-primary hover:underline">
              {post.videoUrl}
            </a>
          </div>
        )}
        <div className="prose prose-sm max-w-none whitespace-pre-line break-words text-sm leading-6">{post.content}</div>
        {post.actionUrl && (
          <Button asChild variant="outline">
            <Link href={post.actionUrl} target="_blank">{post.actionLabel || 'Abrir link'}</Link>
          </Button>
        )}
        {post.poll && (
          <div className="rounded-md border p-4">
            <p className="break-words text-sm font-semibold">{post.poll.question}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {post.poll.options.map((option) => (
                <label key={option.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input type="radio" name="poll" value={option.id} checked={pollAnswer === option.id} onChange={() => setPollAnswer(option.id)} />
                  <span className="break-words">{option.label}</span>
                </label>
              ))}
            </div>
            <Button className="mt-3" onClick={submitPoll} disabled={!pollAnswer}>Responder enquete</Button>
            {post.pollSummary && (
              <div className="mt-4 space-y-2">
                {post.pollSummary.map((option) => (
                  <div key={option.id} className="text-xs">
                    <div className="mb-1 flex justify-between gap-3">
                      <span className="break-words">{option.label}</span>
                      <span>{option.votes}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, option.votes * 20)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => react('LIKE')}><ThumbsUp className="mr-2 h-4 w-4" />Curtir</Button>
          <Button variant="outline" size="sm" onClick={() => react('UNDERSTOOD')}>Entendido</Button>
          <Button variant="outline" size="sm" onClick={() => react('IMPORTANT')}>Importante</Button>
          <Button variant="outline" size="sm" onClick={() => react('QUESTION')}>Tenho dúvida</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <Label>Comentário</Label>
            <Textarea className="mt-1" rows={3} value={commentText} onChange={(event) => setCommentText(event.target.value)} />
            <Button className="mt-2" variant="outline" onClick={submitComment} disabled={!commentText.trim()}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Comentar
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Comentários</p>
            {post.comments.slice(0, 4).map((comment) => (
              <div key={comment.id} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{comment.userName}</p>
                <p className="break-words text-muted-foreground">{comment.body}</p>
              </div>
            ))}
            {post.comments.length === 0 && <p className="text-sm text-muted-foreground">Sem comentários.</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SmallFact label="Público" value={post.audienceSize} />
          <SmallFact label="Leitura" value={formatPercent(post.readRate)} />
          <SmallFact label="Confirmação" value={formatPercent(post.confirmationRate)} />
          <SmallFact label="QR Code" value={<span className="inline-flex items-center gap-1"><QrCode className="h-3 w-3" /> Ativo</span>} />
        </div>
      </CardContent>
    </Card>
  );
}

function CommunicationTable({ posts, onSelect, onStatus }: { posts: CommunicationPost[]; onSelect: (post: CommunicationPost) => void; onStatus: (id: string, status: PostStatus) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Central de Comunicados</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Título</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Prioridade</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Público</th>
              <th className="py-2 pr-3">Leitura</th>
              <th className="py-2 pr-3">Ciência</th>
              <th className="py-2 pr-3">Validade</th>
              <th className="py-2 pr-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b align-top last:border-0">
                <td className="max-w-72 py-3 pr-3">
                  <button onClick={() => onSelect(post)} className="break-words text-left font-medium hover:underline">{post.title}</button>
                  <p className="text-xs text-muted-foreground">{post.category}</p>
                </td>
                <td className="py-3 pr-3">{TYPE_LABEL[post.type]}</td>
                <td className="py-3 pr-3"><PriorityBadge priority={post.priority} /></td>
                <td className="py-3 pr-3"><Badge variant="secondary">{STATUS_LABEL[post.status]}</Badge></td>
                <td className="py-3 pr-3">{post.audienceSize}</td>
                <td className="py-3 pr-3">{formatPercent(post.readRate)}</td>
                <td className="py-3 pr-3">{formatPercent(post.confirmationRate)}</td>
                <td className="py-3 pr-3">{formatDate(post.expiresAt)}</td>
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap gap-2">
                    {post.status !== 'PUBLISHED' && <Button size="sm" variant="outline" onClick={() => onStatus(post.id, 'PUBLISHED')}>Publicar</Button>}
                    {post.status === 'DRAFT' && <Button size="sm" variant="outline" onClick={() => onStatus(post.id, 'PENDING_APPROVAL')}>Aprovação</Button>}
                    {post.status === 'PUBLISHED' && <Button size="sm" variant="outline" onClick={() => onStatus(post.id, 'ARCHIVED')}>Arquivar</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

interface CreatePostFormProps {
  form: CommunicationForm;
  setForm: React.Dispatch<React.SetStateAction<CommunicationForm>>;
  overview?: CommunicationOverview;
  aiPrompt: string;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  generateAi: () => void;
  saving: boolean;
  uploadMedia: UploadMediaFn;
  uploadingMedia: boolean;
  onSubmit: () => void;
}

function CreatePostForm({ form, setForm, overview, aiPrompt, setAiPrompt, generateAi, saving, uploadMedia, uploadingMedia, onSubmit }: CreatePostFormProps) {
  const users = overview?.audienceOptions.users ?? [];
  const areas = overview?.audienceOptions.areas ?? [];
  const templates = overview?.templates ?? [];
  const applyTemplate = (template: TemplateItem) => {
    setForm((current) => ({
      ...current,
      type: template.type,
      category: template.category || current.category,
      title: current.title || template.titlePattern,
      content: current.content ? current.content : template.contentPattern,
    }));
    toast.success(`Template "${template.name}" aplicado`);
  };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Editor visual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Biblioteca de templates
              </div>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    title={`${TYPE_LABEL[template.type]} · ${template.tone}`}
                    className="rounded-full border bg-card px-3 py-1 text-xs font-medium transition hover:border-primary hover:bg-primary/5"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Tipo">
              <NativeSelect value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PostType })}>
                {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Prioridade">
              <NativeSelect value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>
                {Object.entries(PRIORITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Título" className="md:col-span-2">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="Subtítulo" className="md:col-span-2">
              <Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
            </Field>
            <Field label="Categoria">
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </Field>
            <Field label="Validade">
              <Input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
            </Field>
            <Field label="Conteúdo" className="md:col-span-2">
              <Textarea rows={8} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
            </Field>
            <PostMediaFields
              form={form}
              setForm={setForm}
              media={overview?.media ?? []}
              uploadMedia={uploadMedia}
              uploadingMedia={uploadingMedia}
            />
            <Field label="Imagem / banner">
              <Input value={form.coverImageUrl} onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })} />
            </Field>
            <Field label="Vídeo externo">
              <Input value={form.videoUrl} onChange={(event) => setForm({ ...form, videoUrl: event.target.value })} />
            </Field>
            <Field label="Link de ação">
              <Input value={form.actionUrl} onChange={(event) => setForm({ ...form, actionUrl: event.target.value })} />
            </Field>
            <Field label="Texto do botão">
              <Input value={form.actionLabel} onChange={(event) => setForm({ ...form, actionLabel: event.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Público-alvo">
              <NativeSelect value={form.audienceScope} onChange={(event) => setForm({ ...form, audienceScope: event.target.value as AudienceScope })}>
                <option value="ALL_COMPANY">Toda a empresa</option>
                <option value="AREAS">Áreas selecionadas</option>
                <option value="USERS">Usuários específicos</option>
                <option value="MANAGERS">Gestores</option>
                <option value="DIRECTORS">Diretoria</option>
                <option value="ACTIVE_USERS">Usuários ativos</option>
              </NativeSelect>
            </Field>
            <Field label="Publicação">
              <Input type="datetime-local" value={form.publishAt} onChange={(event) => setForm({ ...form, publishAt: event.target.value })} />
            </Field>
          </div>
          {form.audienceScope === 'AREAS' && (
            <MultiCheck
              title="Áreas"
              items={areas.map((area: any) => ({ id: area.id, label: area.name }))}
              selected={form.audienceAreaIds}
              onToggle={(id) => setForm({ ...form, audienceAreaIds: toggle(form.audienceAreaIds, id) })}
            />
          )}
          {form.audienceScope === 'USERS' && (
            <MultiCheck
              title="Usuários"
              items={users.map((user: any) => ({ id: user.id, label: `${user.name} · ${user.areaName ?? 'sem área'}` }))}
              selected={form.audienceUserIds}
              onToggle={(id) => setForm({ ...form, audienceUserIds: toggle(form.audienceUserIds, id) })}
            />
          )}
          <MultiCheck
            title="Canais"
            items={CHANNELS.map((channel) => ({ id: channel.key, label: channel.label }))}
            selected={CHANNELS.filter((channel) => form.channels[channel.key]).map((channel) => channel.key)}
            onToggle={(key) => setForm({ ...form, channels: { ...form.channels, [key]: !form.channels[key as keyof ChannelConfig] } })}
          />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {BOOLEAN_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <input type="checkbox" checked={Boolean(form[key])} onChange={() => setForm({ ...form, [key]: !form[key] })} />
                {label}
              </label>
            ))}
          </div>
          {(form.type === 'POLL' || form.type === 'SURVEY' || form.requiresPollAnswer) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Pergunta" className="md:col-span-2">
                <Input value={form.pollQuestion} onChange={(event) => setForm({ ...form, pollQuestion: event.target.value })} />
              </Field>
              <Field label="Opções">
                <Textarea rows={4} value={form.pollOptions} onChange={(event) => setForm({ ...form, pollOptions: event.target.value })} />
              </Field>
              <Field label="Prazo da enquete">
                <Input type="datetime-local" value={form.pollDueAt} onChange={(event) => setForm({ ...form, pollDueAt: event.target.value })} />
              </Field>
            </div>
          )}
          <Button onClick={onSubmit} disabled={saving || !form.title || !form.content}>
            <Send className="mr-2 h-4 w-4" />
            Salvar comunicado
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>IA e pré-visualização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Briefing para IA">
            <Textarea rows={4} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} />
          </Field>
          <Button variant="outline" onClick={generateAi}>
            <Sparkles className="mr-2 h-4 w-4" />
            Gerar texto
          </Button>
          <div className="rounded-md border p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <PriorityBadge priority={form.priority} />
              <Badge variant="secondary">{TYPE_LABEL[form.type]}</Badge>
            </div>
            <h3 className="break-words text-lg font-semibold">{form.title || 'Título do comunicado'}</h3>
            <p className="mt-1 break-words text-sm text-muted-foreground">{form.subtitle || 'Subtítulo'}</p>
            <p className="mt-4 whitespace-pre-line break-words text-sm">{form.content || 'Conteúdo do comunicado.'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PostMediaFields({
  form,
  setForm,
  media,
  uploadMedia,
  uploadingMedia,
}: {
  form: CommunicationForm;
  setForm: React.Dispatch<React.SetStateAction<CommunicationForm>>;
  media: MediaItem[];
  uploadMedia: UploadMediaFn;
  uploadingMedia: boolean;
}) {
  const images = media.filter(isImageMedia).slice(0, 6);
  const videos = media.filter(isVideoMedia).slice(0, 4);
  const applyMedia = (item: MediaItem) => {
    if (!item.url) return;
    if (isVideoMedia(item)) {
      setForm((current) => ({ ...current, videoUrl: item.url ?? current.videoUrl, type: current.type === 'SIMPLE' ? 'VIDEO' : current.type }));
      return;
    }
    setForm((current) => ({ ...current, coverImageUrl: item.url ?? current.coverImageUrl, type: current.type === 'SIMPLE' ? 'BANNER' : current.type }));
  };
  return (
    <div className="md:col-span-2 space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Mídia do comunicado</p>
          <p className="text-xs text-muted-foreground">Upload de imagem com ajuste e vídeo curto.</p>
        </div>
        <MediaAssetUploader
          uploadMedia={uploadMedia}
          uploadingMedia={uploadingMedia}
          imageType="BANNER"
          category="Comunicados"
          onUploaded={applyMedia}
        />
      </div>

      {(form.coverImageUrl || form.videoUrl) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {form.coverImageUrl && (
            <div className="overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.coverImageUrl} alt="Imagem do comunicado" className="h-40 w-full object-cover" />
            </div>
          )}
          {form.videoUrl && (
            <div className="overflow-hidden rounded-md border">
              {isPlayableVideoUrl(form.videoUrl) ? (
                <video className="h-40 w-full bg-black object-contain" controls preload="metadata">
                  <source src={form.videoUrl} />
                </video>
              ) : (
                <div className="flex h-40 items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-all">{form.videoUrl}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(images.length > 0 || videos.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Acervo</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[...images, ...videos].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyMedia(item)}
                className="min-w-0 overflow-hidden rounded-md border text-left transition hover:border-primary hover:bg-muted"
              >
                <MediaPreview item={item} className="h-20 rounded-none border-0" />
                <span className="block truncate px-2 py-1 text-xs">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MediaAssetUploader({
  uploadMedia,
  uploadingMedia,
  onUploaded,
  imageType = 'IMAGE',
  category = 'Geral',
}: {
  uploadMedia: UploadMediaFn;
  uploadingMedia: boolean;
  onUploaded?: (item: MediaItem) => void;
  imageType?: 'IMAGE' | 'BANNER';
  category?: string;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const disabled = uploadingMedia || busy;

  const uploadAdjustedImage = async (payload: AdjustedImageUpload) => {
    setBusy(true);
    try {
      const item = await uploadMedia({ ...payload, category, tags: ['upload', 'imagem'] });
      onUploaded?.(item);
      toast.success('Imagem enviada');
      setImageDialogOpen(false);
      setImageFile(null);
    } finally {
      setBusy(false);
    }
  };

  const uploadVideoFile = async (file: File) => {
    if (file.size > MAX_COMMUNICATION_MEDIA_BYTES) {
      toast.error('O vídeo deve ter até 6 MB.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const item = await uploadMedia({
        fileName: file.name,
        name: file.name.replace(/\.[^.]+$/, ''),
        mimeType: file.type || inferVideoMime(file.name),
        sizeBytes: file.size,
        dataBase64: stripDataUrl(dataUrl),
        type: 'VIDEO',
        category,
        tags: ['upload', 'video'],
      });
      onUploaded?.(item);
      toast.success('Vídeo enviado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={disabled}>
        <ImagePlus className="mr-2 h-4 w-4" />
        Imagem
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} disabled={disabled}>
        <Video className="mr-2 h-4 w-4" />
        Vídeo
      </Button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = '';
          if (!file) return;
          setImageFile(file);
          setImageDialogOpen(true);
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = '';
          if (file) void uploadVideoFile(file);
        }}
      />
      <ImageAdjustDialog
        file={imageFile}
        open={imageDialogOpen}
        imageType={imageType}
        disabled={disabled}
        onOpenChange={setImageDialogOpen}
        onApply={uploadAdjustedImage}
      />
    </div>
  );
}

function ImageAdjustDialog({
  file,
  open,
  imageType,
  disabled,
  onOpenChange,
  onApply,
}: {
  file: File | null;
  open: boolean;
  imageType: 'IMAGE' | 'BANNER';
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: AdjustedImageUpload) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const initialPreset = IMAGE_PRESETS.find((preset) => preset.type === imageType) ?? IMAGE_PRESETS[0]!;
  const [presetId, setPresetId] = useState(initialPreset.id);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [quality, setQuality] = useState(86);
  const [ready, setReady] = useState(false);
  const preset = IMAGE_PRESETS.find((item) => item.id === presetId) ?? initialPreset;

  useEffect(() => {
    if (!file || !open) return;
    setReady(false);
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      imageRef.current = image;
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setReady(true);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      toast.error('Não foi possível abrir a imagem.');
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }, [file, open]);

  useEffect(() => {
    drawAdjustedImage(canvasRef.current, imageRef.current, preset.width, preset.height, zoom, offsetX, offsetY);
  }, [preset.width, preset.height, zoom, offsetX, offsetY, ready]);

  const apply = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file || !ready) return;
    drawAdjustedImage(canvas, imageRef.current, preset.width, preset.height, zoom, offsetX, offsetY);
    const dataUrl = canvas.toDataURL('image/jpeg', quality / 100);
    const dataBase64 = stripDataUrl(dataUrl);
    const sizeBytes = base64ByteSize(dataBase64);
    if (sizeBytes > MAX_COMMUNICATION_MEDIA_BYTES) {
      toast.error('A imagem ajustada passou de 6 MB.');
      return;
    }
    await onApply({
      fileName: adjustedImageName(file.name),
      name: file.name.replace(/\.[^.]+$/, ''),
      mimeType: 'image/jpeg',
      sizeBytes,
      dataBase64,
      type: preset.type,
      adjustments: {
        preset: preset.id,
        width: preset.width,
        height: preset.height,
        zoom,
        offsetX,
        offsetY,
        quality,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Ajustar imagem
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 overflow-hidden rounded-md border bg-muted/30 p-2">
            <canvas ref={canvasRef} className="max-h-[520px] w-full rounded-md bg-white object-contain" />
          </div>
          <div className="space-y-4">
            <Field label="Formato">
              <NativeSelect value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                {IMAGE_PRESETS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </NativeSelect>
            </Field>
            <RangeControl label="Zoom" value={zoom} min={1} max={2.5} step={0.05} onChange={setZoom} />
            <RangeControl label="Horizontal" value={offsetX} min={-50} max={50} step={1} onChange={setOffsetX} />
            <RangeControl label="Vertical" value={offsetY} min={-50} max={50} step={1} onChange={setOffsetY} />
            <RangeControl label="Qualidade" value={quality} min={60} max={95} step={1} onChange={setQuality} suffix="%" />
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              {preset.width} x {preset.height}px
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>Cancelar</Button>
          <Button type="button" onClick={apply} disabled={disabled || !ready}>
            <Crop className="mr-2 h-4 w-4" />
            Aplicar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{Number(value).toFixed(step < 1 ? 2 : 0)}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function CampaignsPanel({ campaigns, createCampaign }: { campaigns: Campaign[]; createCampaign: (payload: any) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Campanha corporativa');
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.6fr_1fr]">
      <Card>
        <CardHeader><CardTitle>Nova campanha</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Nome"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Categoria"><Input value={category} onChange={(event) => setCategory(event.target.value)} /></Field>
          <Button onClick={() => name && createCampaign({ name, category, status: 'ACTIVE' })}>Criar campanha</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Campanhas internas</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-md border p-3">
              <p className="break-words font-medium">{campaign.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{campaign.category} · {campaign.status}</p>
              <p className="mt-3 break-words text-sm">{campaign.objective}</p>
            </div>
          ))}
          {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha criada.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricsPanel({ data }: { data?: CommunicationOverview }) {
  const evolution = data?.charts?.monthlyEvolution ?? [];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Evolução mensal</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolution} margin={{ left: -16, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="published" stroke="#2563eb" strokeWidth={2} />
              <Line type="monotone" dataKey="views" stroke="#16a34a" strokeWidth={2} />
              <Line type="monotone" dataKey="confirmations" stroke="#d97706" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Pendências por gestor</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data?.charts?.pendingByManager ?? []).slice(0, 10).map((item) => (
            <div key={`${item.manager}-${item.area}`} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span className="min-w-0 break-words">{item.manager} · {item.area}</span>
              <Badge variant={item.pending > 0 ? 'destructive' : 'secondary'}>{item.pending}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MediaPanel({
  media,
  createMedia,
  uploadMedia,
  uploadingMedia,
}: {
  media: MediaItem[];
  createMedia: (payload: any) => Promise<unknown>;
  uploadMedia: UploadMediaFn;
  uploadingMedia: boolean;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'IMAGE' | 'BANNER' | 'VIDEO' | 'DOCUMENT'>('IMAGE');
  const [category, setCategory] = useState('Geral');
  const addExternalMedia = async () => {
    if (!name.trim()) return;
    await createMedia({ name, url, type, category });
    setName('');
    setUrl('');
  };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.6fr_1fr]">
      <Card>
        <CardHeader><CardTitle>Biblioteca de mídias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <MediaAssetUploader
            uploadMedia={uploadMedia}
            uploadingMedia={uploadingMedia}
            category={category}
            onUploaded={() => undefined}
          />
          <Field label="Nome"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="URL"><Input value={url} onChange={(event) => setUrl(event.target.value)} /></Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Tipo">
              <NativeSelect value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                <option value="IMAGE">Imagem</option>
                <option value="BANNER">Banner</option>
                <option value="VIDEO">Vídeo</option>
                <option value="DOCUMENT">Documento</option>
              </NativeSelect>
            </Field>
            <Field label="Categoria"><Input value={category} onChange={(event) => setCategory(event.target.value)} /></Field>
          </div>
          <Button onClick={() => void addExternalMedia()} disabled={!name.trim()}>
            <Link2 className="mr-2 h-4 w-4" />
            Adicionar link
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Acervo e modelos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {media.map((item) => (
            <div key={item.id} className="space-y-3 rounded-md border p-3">
              <MediaPreview item={item} className="h-40" />
              <div>
                <p className="break-words font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.type} · {item.category}</p>
              </div>
              {item.url && (
                <Button asChild variant="outline" size="sm">
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <Link2 className="mr-2 h-3.5 w-3.5" />
                    Abrir
                  </a>
                </Button>
              )}
            </div>
          ))}
          {media.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mídia cadastrada.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function MediaPreview({ item, className }: { item: MediaItem; className?: string }) {
  const url = item.url ?? '';
  if (url && isVideoMedia(item) && isPlayableVideoUrl(url)) {
    return (
      <video className={cn('w-full rounded-md border bg-black object-contain', className)} controls preload="metadata">
        <source src={url} />
      </video>
    );
  }
  if (url && isImageMedia(item)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={item.name} className={cn('w-full rounded-md border object-cover', className)} />;
  }
  const Icon = isVideoMedia(item) ? Film : isImageMedia(item) ? ImageIcon : FileText;
  return (
    <div className={cn('grid w-full place-items-center rounded-md border bg-muted text-muted-foreground', className)}>
      <Icon className="h-6 w-6" />
    </div>
  );
}

function ChatWorkspace({ conversations, selectedId, selected, isLoading, onSelect }: { conversations: ConversationSummary[]; selectedId: string | null; selected: ConversationSummary | null; isLoading: boolean; onSelect: (id: string) => void }) {
  return (
    <div className="grid h-[calc(100vh-14rem)] min-h-[560px] overflow-hidden rounded-lg border border-border/60 bg-card lg:grid-cols-[320px_minmax(0,1fr)_310px]">
      <aside className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
        <ConversationList conversations={conversations} selectedId={selectedId} onSelect={onSelect} isLoading={isLoading} />
      </aside>
      <section className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
        {isLoading ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            <MessageSquare className="mr-2 h-4 w-4" />
            Iniciando conversa...
          </div>
        ) : (
          <ChatPanel conversation={selected} />
        )}
      </section>
      <aside className="hidden min-h-0 lg:block">
        <ContactDetails conversation={selected} />
      </aside>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function MultiCheck({ title, items, selected, onToggle }: { title: string; items: Array<{ id: string; label: string }>; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div>
      <Label>{title}</Label>
      <div className="mt-2 grid max-h-56 grid-cols-1 gap-2 overflow-auto rounded-md border p-3 md:grid-cols-2">
        {items.map((item) => (
          <label key={item.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant="outline" className={cn('shrink-0', PRIORITY_STYLE[priority])}>{PRIORITY_LABEL[priority]}</Badge>;
}

function SmallFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function toneClass(tone: string) {
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

function isImageMedia(item: Pick<MediaItem, 'type' | 'url'>) {
  return item.type === 'IMAGE' || item.type === 'BANNER' || Boolean(item.url?.startsWith('data:image/'));
}

function isVideoMedia(item: Pick<MediaItem, 'type' | 'url'>) {
  return item.type === 'VIDEO' || Boolean(item.url?.startsWith('data:video/'));
}

function isPlayableVideoUrl(url: string) {
  return url.startsWith('data:video/') || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Nao foi possivel ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function stripDataUrl(dataUrl: string) {
  return dataUrl.includes(',') ? dataUrl.split(',').pop() ?? '' : dataUrl;
}

function base64ByteSize(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function inferVideoMime(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'webm') return 'video/webm';
  if (extension === 'ogg' || extension === 'ogv') return 'video/ogg';
  if (extension === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

function adjustedImageName(fileName: string) {
  return `${fileName.replace(/\.[^.]+$/, '') || 'imagem'}-ajustada.jpg`;
}

function drawAdjustedImage(
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

function formPayload(form: typeof defaultForm) {
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

function audienceLabel(scope: AudienceScope) {
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

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

// ==========================================
// Central de Comunicação Organizacional
// Componente Dashboard de Alta Fidelidade Visual
// ==========================================

interface KpiCardProps {
  title: string;
  value: string | number;
  change: string;
  color: 'emerald' | 'purple' | 'amber' | 'rose' | 'sky';
  icon: React.ComponentType<any>;
}

function KpiCard({ title, value, change, color, icon: Icon }: KpiCardProps) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 dark:bg-emerald-500/20 border-emerald-500/10',
    purple: 'bg-violet-500/10 text-violet-650 dark:text-violet-400 dark:bg-violet-500/20 border-violet-500/10',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20 border-amber-500/10',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/20 border-rose-500/10',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 dark:bg-sky-500/20 border-sky-500/10',
  };

  return (
    <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block truncate">{title}</span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">{value}</div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block truncate mt-0.5">{change}</div>
        </div>
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ml-2', colorClasses[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionBtn({ icon: Icon, title, onClick }: { icon: React.ComponentType<any>; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md hover:border-slate-200/50 dark:hover:border-slate-800"
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center border bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/40 text-sky-500">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="text-[10px] font-bold text-slate-850 dark:text-slate-200 leading-snug max-w-[90px]">{title}</div>
    </button>
  );
}

function CampaignItem({ time, title, color, type }: { time: string; title: string; color: 'purple' | 'green' | 'amber' | 'blue'; type: string }) {
  const borderColors = {
    purple: 'border-l-violet-500 bg-violet-500/5 dark:bg-violet-500/10 text-violet-750 dark:text-violet-400',
    green: 'border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-750 dark:text-emerald-400',
    amber: 'border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10 text-amber-750 dark:text-amber-400',
    blue: 'border-l-sky-500 bg-sky-500/5 dark:bg-sky-500/10 text-sky-750 dark:text-sky-400',
  };

  return (
    <div className={cn('p-3 rounded-r-lg border border-slate-100 dark:border-slate-800 border-l-4 transition-all hover:shadow-sm', borderColors[color])}>
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span>{time}</span>
        <span className="uppercase text-[8px] tracking-wider opacity-80">{type}</span>
      </div>
      <div className="text-xs font-bold text-slate-850 dark:text-slate-150 mt-1 line-clamp-1">{title}</div>
    </div>
  );
}

interface CommunicationDashboardViewProps {
  data?: CommunicationOverview;
  loading: boolean;
  channelFilter: string;
  setChannelFilter: (v: string) => void;
  setTab: (tab: CommunicationTab) => void;
  onCreatePreset: (preset: Partial<CommunicationForm>) => void;
  onSelectPost: (id: string) => void;
  onMessageUser: (id: string) => void;
  unread: number;
  conversationCount: number;
  canCreate: boolean;
}

function CommunicationDashboardView({
  data,
  loading,
  channelFilter,
  setChannelFilter,
  setTab,
  onCreatePreset,
  onSelectPost,
  onMessageUser,
  unread,
  conversationCount,
  canCreate,
}: CommunicationDashboardViewProps) {
  const router = useRouter();

  const posts = data?.posts ?? [];
  const countPublished = data?.metrics?.publishedThisMonth ?? 0;
  const countDrafts = data?.metrics?.drafts ?? 0;
  const readRate = data?.metrics?.readRate ?? 0;
  const countPending = data?.metrics?.mandatoryPending ?? 0;
  const activePolls = posts.filter((post) => ['POLL', 'SURVEY'].includes(post.type) && post.status === 'PUBLISHED').length;
  const countCritical = data?.metrics?.critical ?? 0;
  const countMessages = unread;
  const countReach = data?.metrics?.totalViews ?? 0;
  const countImpacted = posts.filter((post) => post.status === 'PUBLISHED').reduce((sum, post) => sum + post.audienceSize, 0);
  const countScheduled = data?.metrics?.scheduled ?? 0;

  const CHANNELS = [
    { label: 'Todos os canais', filter: 'Todos os canais' },
    { label: 'Mural', filter: 'Mural' },
    { label: 'E-mail', filter: 'E-mail' },
    { label: 'Push', filter: 'Push' },
    { label: 'In-app', filter: 'In-app' },
    { label: 'Banner', filter: 'Banner' },
    { label: 'Enquete', filter: 'Enquete' },
    { label: 'Confirmação obrigatória', filter: 'Confirmação' },
  ];

  const pendingStaff = data?.team?.pendingPeople ?? [];
  const publicSegments = data?.charts?.readByArea ?? [];
  const channelDefinitions = [
    { name: 'Mural', matches: (post: CommunicationPost) => Boolean(post.channels.digitalBoard) },
    { name: 'Push', matches: (post: CommunicationPost) => Boolean(post.channels.push) },
    { name: 'E-mail', matches: (post: CommunicationPost) => Boolean(post.channels.email) },
    { name: 'In-app', matches: (post: CommunicationPost) => Boolean(post.channels.platform || post.channels.myDay || post.channels.homeCard) },
    { name: 'Banner', matches: (post: CommunicationPost) => Boolean(post.channels.topBanner || post.type === 'BANNER') },
    { name: 'Enquete', matches: (post: CommunicationPost) => ['POLL', 'SURVEY'].includes(post.type) },
  ];
  const channelRates = channelDefinitions.map((channel) => {
    const channelPosts = posts.filter(channel.matches);
    const delivered = channelPosts.reduce((sum, post) => sum + post.audienceSize, 0);
    const views = channelPosts.reduce((sum, post) => sum + post.receipts.length, 0);
    return { name: channel.name, rate: delivered > 0 ? views / delivered : 0, posts: channelPosts.length };
  });
  const recentPosts = posts.filter((post) => {
    if (channelFilter === 'Todos os canais') return true;
    if (channelFilter === 'Confirmação') return post.requiresReadConfirmation;
    return channelDefinitions.find((channel) => channel.name === channelFilter)?.matches(post) ?? true;
  });
  const pollResponses = posts.reduce((sum, post) => sum + post.pollResponses.length, 0);
  const featuredPost = posts.find((post) => post.isFeatured) ?? data?.charts?.mostAccessed?.[0] ?? null;

  return (
    <div className="space-y-6">
      
      {/* 1. Cabeçalho */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800/85 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-500 uppercase tracking-wider">
            <span>Comunicação</span>
            <span className="text-slate-400 dark:text-slate-650">/</span>
            <span className="text-slate-550 dark:text-slate-400">Meu Mural</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-slate-900 dark:text-white font-sans">Comunicação Organizacional</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Comunicados, campanhas, mural, pesquisas, confirmações e chat corporativo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <>
              <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={() => setTab('criar')}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo comunicado
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 border-slate-200 bg-card hover:bg-muted" onClick={() => setTab('campanhas')}>
                <Plus className="h-4 w-4 text-sky-500" />
                Nova campanha
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-200 bg-card hover:bg-muted" onClick={() => router.push('/pessoas')}>
            <Users className="h-4 w-4 text-slate-500" />
            Pessoas
          </Button>
          <Button variant="outline" size="sm" className="h-9 px-3 border-slate-200 bg-card hover:bg-muted" title="Métricas e relatórios" onClick={() => setTab('metricas')}>
            <SlidersHorizontal className="h-4 w-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* 2. Barra de Filtros por Canal */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {CHANNELS.map((ch) => (
          <button
            key={ch.label}
            onClick={() => setChannelFilter(ch.filter)}
            className={cn(
              'h-8 px-3.5 rounded-full text-xs font-semibold border transition-all shrink-0',
              channelFilter === ch.filter
                ? 'bg-sky-500 border-sky-500 text-white shadow-sm'
                : 'bg-card border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-muted'
            )}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* 3. Cards de Indicadores (KPIs) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard title="Publicados no mês" value={countPublished} change="Publicações registradas no período" color="emerald" icon={Megaphone} />
        <KpiCard title="Rascunhos" value={countDrafts} change={`${data?.metrics?.pendingApproval ?? 0} aguardando aprovação`} color="purple" icon={FileText} />
        <KpiCard title="Taxa de leitura" value={`${(readRate * 100).toFixed(1)}%`} change={`${countReach} visualizações registradas`} color="emerald" icon={BookOpenCheck} />
        <KpiCard title="Confirmações pendentes" value={countPending} change="Pendências obrigatórias reais" color="amber" icon={ClipboardCheck} />
        <KpiCard title="Enquetes ativas" value={activePolls} change={`${pollResponses} respostas registradas`} color="purple" icon={Vote} />
        <KpiCard title="Comunicados críticos" value={countCritical} change="Publicações em prioridade crítica" color="rose" icon={AlertTriangle} />
        <KpiCard title="Mensagens internas" value={countMessages} change="Não lidas no chat" color="sky" icon={MessageCircle} />
        <KpiCard title="Visualizações" value={countReach.toLocaleString('pt-BR')} change="Leituras acumuladas" color="sky" icon={Users} />
        <KpiCard title="Entregas" value={countImpacted.toLocaleString('pt-BR')} change="Audiências das publicações" color="emerald" icon={Users} />
        <KpiCard title="Agendados" value={countScheduled} change="Programados para publicação" color="sky" icon={Clock} />
      </div>

      {/* 4. Faixa de Ações Rápidas */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        <QuickActionBtn icon={Plus} title="Criar comunicado" onClick={() => onCreatePreset({})} />
        <QuickActionBtn icon={Megaphone} title="Agendar campanha" onClick={() => setTab('campanhas')} />
        <QuickActionBtn icon={SlidersHorizontal} title="Publicar no mural" onClick={() => onCreatePreset({ channels: { ...defaultForm.channels, digitalBoard: true } })} />
        <QuickActionBtn icon={ClipboardCheck} title="Enviar confirmação obrigatória" onClick={() => onCreatePreset({ isMandatory: true, requiresReadConfirmation: true, channels: { ...defaultForm.channels, mandatoryPopup: true } })} />
        <QuickActionBtn icon={Vote} title="Criar enquete" onClick={() => onCreatePreset({ type: 'POLL', requiresPollAnswer: true })} />
        <QuickActionBtn icon={MessageSquare} title="Mensagem para equipes" onClick={() => setTab('chat')} />
        <QuickActionBtn icon={FileText} title="Biblioteca de templates" onClick={() => onCreatePreset({})} />
      </div>

      {/* 5. Grid Principal (3 Colunas) */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Coluna Esquerda */}
        <div className="space-y-6">
          {/* Pendências obrigatórias */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <ClipboardCheck className="h-4 w-4 text-amber-500" />
                Pendências obrigatórias
                <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-650 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">{countPending}</span>
              </h3>
            </div>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {pendingStaff.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">Nenhum colaborador com confirmação obrigatória pendente.</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-850/40">
                {pendingStaff.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-sky-500/10 text-[10px] font-bold text-sky-600">{staff.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-855 dark:text-slate-200 truncate">{staff.name}</div>
                        <div className="text-[10px] font-medium text-sky-500 truncate line-clamp-1 mt-0.5">{staff.pending} confirmação(ões) pendente(s)</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 text-sky-500 border border-sky-100 hover:bg-sky-50/40 dark:border-sky-950/20 dark:hover:bg-sky-950/10 rounded-md" onClick={() => onMessageUser(staff.id)}>
                        Cobrar
                      </Button>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </CardContent>
            <div className="border-t p-2 text-center shrink-0">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-600" onClick={() => setTab('metricas')}>
                Ver todas as pendências →
              </Button>
            </div>
          </Card>

          {/* Segmentos / Públicos */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[280px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Users className="h-4 w-4 text-sky-500" />
                Segmentos / Públicos
              </h3>
            </div>
            <CardContent className="p-3 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {publicSegments.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Sem dados de audiência por área.</div>}
                {publicSegments.map((segment) => (
                  <button type="button" key={segment.area} onClick={() => setTab('metricas')} className="flex w-full items-center justify-between text-xs py-1 hover:bg-slate-50/20 px-1.5 rounded transition-all">
                    <span className="font-medium text-slate-700 dark:text-slate-350">{segment.area}</span>
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-650 dark:text-slate-450 border border-slate-200/30 dark:border-slate-700/30">
                      {segment.read}/{segment.delivered} · {(segment.readRate * 100).toFixed(0)}%
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
            <div className="border-t p-2 text-center shrink-0">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-600" onClick={() => setTab('metricas')}>
                Ver todos os segmentos →
              </Button>
            </div>
          </Card>

          {/* Chat e interações */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[260px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <MessageCircle className="h-4 w-4 text-sky-500" />
                Chat e interações
              </h3>
            </div>
            <CardContent className="p-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400">Mensagens não lidas</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">{unread}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t pt-2 border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Confirmações pendentes</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400">{countPending}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t pt-2 border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Conversas ativas</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">{conversationCount}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t pt-2 border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Bots e automações</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-955/40 text-sky-600 dark:text-sky-400">{(data?.automations ?? []).filter((rule) => rule.active).length}</span>
                </div>
              </div>
              <Button size="sm" className="w-full mt-3 h-8 bg-sky-500 hover:bg-sky-600 text-white font-semibold" onClick={() => setTab('chat')}>
                Abrir chat
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Central */}
        <div className="space-y-6 lg:col-span-1">
          {/* Comunicados recentes */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Megaphone className="h-4 w-4 text-sky-500" />
                Comunicados recentes
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 hover:text-sky-600" onClick={() => setTab('central')}>Ver todos</Button>
            </div>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Carregando comunicados...</div>
              ) : recentPosts.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full">
                  <Megaphone className="h-8 w-8 text-slate-350 dark:text-slate-700 mb-2" />
                  Nenhum comunicado recente publicado.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recentPosts.slice(0, 5).map((post) => (
                    <div key={post.id} className="p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all cursor-pointer flex flex-col gap-1" onClick={() => onSelectPost(post.id)}>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 border border-sky-500/20 uppercase tracking-wider">{post.category}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(post.createdAt)}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-850 dark:text-slate-200 line-clamp-1">{post.title}</div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Público: {audienceLabel(post.audience.scope)}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-450">Leitura: {post.readRate ? (post.readRate * 100).toFixed(0) : '0'}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <div className="border-t p-2 text-center shrink-0">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-600" onClick={() => setTab('central')}>
                Ver todos os comunicados →
              </Button>
            </div>
          </Card>

          {/* Calendário de campanhas */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[560px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Clock className="h-4 w-4 text-violet-500" />
                Calendário de campanhas
                <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">{data?.campaigns?.length ?? 0} cadastrada(s)</span>
              </h3>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-between gap-3">
              
              <div className="flex-1 space-y-3 mt-3 overflow-y-auto pr-1">
                {(data?.campaigns ?? []).length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">Nenhuma campanha cadastrada.</div>
                ) : (data?.campaigns ?? []).map((campaign, index) => (
                  <button type="button" key={campaign.id} className="block w-full text-left" onClick={() => setTab('campanhas')}>
                    <CampaignItem
                      time={campaign.startsAt ? formatDate(campaign.startsAt) : 'Sem início'}
                      title={campaign.name}
                      color={(['purple', 'green', 'amber', 'blue'] as const)[index % 4]}
                      type={`${campaign.category} · ${campaign.status}`}
                    />
                  </button>
                ))}
              </div>

              <div className="border-t pt-3 text-center shrink-0">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-600" onClick={() => setTab('campanhas')}>
                  Ver calendário completo →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita */}
        <div className="space-y-6">
          {/* Engajamento */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                Engajamento <span className="text-[10px] text-slate-400 dark:text-slate-500">(últimos 30 dias)</span>
              </h3>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-between gap-3 text-xs text-slate-850 dark:text-slate-200">
              {/* Sparkline 1: Leitura */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Leitura</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{((data?.metrics?.readRate ?? 0) * 100).toFixed(1)}%</div>
                  <div className="text-[9px] text-emerald-600 font-bold">Sobre a audiência entregue</div>
                </div>
                <div className="w-28 h-8 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path d="M 0,35 Q 20,20 40,25 T 80,10 L 100,8" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 0,35 Q 20,20 40,25 T 80,10 L 100,8 L 100,40 L 0,40 Z" fill="url(#sparkline-green-comm)" opacity="0.1" />
                    <defs>
                      <linearGradient id="sparkline-green-comm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Sparkline 2: Confirmação */}
              <div className="flex items-center justify-between gap-4 border-t pt-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Confirmação</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{((data?.metrics?.confirmationRate ?? 0) * 100).toFixed(1)}%</div>
                  <div className="text-[9px] text-emerald-600 font-bold">Ciências obrigatórias confirmadas</div>
                </div>
                <div className="w-28 h-8 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path d="M 0,30 Q 15,25 35,28 T 75,15 L 100,10" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 0,30 Q 15,25 35,28 T 75,15 L 100,10 L 100,40 L 0,40 Z" fill="url(#sparkline-blue-comm)" opacity="0.1" />
                    <defs>
                      <linearGradient id="sparkline-blue-comm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Sparkline 3: Respostas */}
              <div className="flex items-center justify-between gap-4 border-t pt-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Respostas (enquetes)</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{pollResponses}</div>
                  <div className="text-[9px] text-emerald-600 font-bold">{((data?.metrics?.pollResponseRate ?? 0) * 100).toFixed(1)}% da audiência</div>
                </div>
                <div className="w-28 h-8 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path d="M 0,35 Q 25,15 50,30 T 100,10" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 0,35 Q 25,15 50,30 T 100,10 L 100,40 L 0,40 Z" fill="url(#sparkline-purple-comm)" opacity="0.1" />
                    <defs>
                      <linearGradient id="sparkline-purple-comm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Sparkline 4: Alcance */}
              <div className="flex items-center justify-between gap-4 border-t pt-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Alcance</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{countReach.toLocaleString('pt-BR')}</div>
                  <div className="text-[9px] text-emerald-600 font-bold">Visualizações registradas</div>
                </div>
                <div className="w-28 h-8 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path d="M 0,20 Q 30,10 60,30 T 100,5" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 0,20 Q 30,10 60,30 T 100,5 L 100,40 L 0,40 Z" fill="url(#sparkline-sky-comm)" opacity="0.1" />
                    <defs>
                      <linearGradient id="sparkline-sky-comm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Canais */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[280px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <SlidersHorizontal className="h-4 w-4 text-sky-500" />
                Canais
              </h3>
            </div>
            <CardContent className="p-3 flex-1 overflow-y-auto">
              <div className="space-y-2.5">
                {channelRates.map((channel) => (
                  <div key={channel.name} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{channel.name} <small>({channel.posts})</small></span>
                    <div className="flex items-center gap-2 w-1/2">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, channel.rate * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 shrink-0 w-8 text-right">{(channel.rate * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="border-t p-2 text-center shrink-0">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-655" onClick={() => setTab('metricas')}>
                Ver desempenho por canal →
              </Button>
            </div>
          </Card>

          {/* Destaques */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden flex flex-col h-[260px]">
            <div className="h-[120px] bg-gradient-to-tr from-blue-600 via-indigo-650 to-sky-500 flex flex-col justify-end p-3 relative shrink-0">
              <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
              <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider">
                DESTAQUE
              </div>
              <div className="text-[10px] text-white/80 font-bold tracking-wider uppercase">{featuredPost?.category ?? 'Comunicação'}</div>
              <h4 className="text-sm font-extrabold text-white line-clamp-1 leading-snug">{featuredPost?.title ?? 'Nenhum destaque publicado'}</h4>
            </div>
            <CardContent className="p-3 flex-1 flex flex-col justify-between">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {featuredPost ? featuredPost.content.replace(/<[^>]*>/g, ' ') : 'Marque um comunicado como destaque para exibi-lo neste espaço.'}
              </p>
              <div className="flex items-center justify-between border-t pt-2.5 mt-2">
                <span className="text-[9px] text-slate-400">{featuredPost ? `Publicado em: ${formatDate(featuredPost.publishedAt ?? featuredPost.createdAt)}` : 'Sem publicação'}</span>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-sky-500 border border-sky-100 hover:bg-sky-50/50 dark:border-sky-900/40" onClick={() => featuredPost && onSelectPost(featuredPost.id)} disabled={!featuredPost}>
                  Ver comunicado completo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* 6. Rodapé Operacional */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>Fonte dos dados: <strong>API de comunicação organizacional</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-500" />
            <span>Visualizações / entregas: <strong>{countReach.toLocaleString('pt-BR')} de {countImpacted.toLocaleString('pt-BR')}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-400" />
            <span>Templates disponíveis: <strong>{data?.templates?.length ?? 0}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-slate-650 dark:text-slate-400 hover:text-slate-900" onClick={() => setTab('metricas')}>
            <FileUp className="h-3.5 w-3.5" />
            Relatórios e dados
          </Button>
          <button type="button" onClick={() => router.push('/central-atendimento')} className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105" title="Central de Atendimento">
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
