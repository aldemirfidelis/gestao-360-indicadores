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
  FileBarChart,
  FileText,
  Image as ImageIcon,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MonitorPlay,
  PlaySquare,
  Plus,
  QrCode,
  Radio,
  Send,
  Sparkles,
  ThumbsUp,
  Users,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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

export default function ComunicacaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const requestedConversation = searchParams.get('c');
  const requestedUser = searchParams.get('to');
  const requestedPost = searchParams.get('post');
  const startedFor = useRef<string | null>(null);
  const [tab, setTab] = useState(requestedConversation || requestedUser ? 'chat' : 'mural');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(requestedPost);
  const [form, setForm] = useState(defaultForm);
  const [aiPrompt, setAiPrompt] = useState('');
  const [commentText, setCommentText] = useState('');
  const [pollAnswer, setPollAnswer] = useState('');

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
    onSuccess: () => overview.refetch(),
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
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? data?.myWall.mandatoryPending[0] ?? data?.myWall.recent[0] ?? null;
  const canCreate = hasPermission(['communication:create', 'communication:manage', 'communication:attachments']);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Comunicação"
        tone="view"
        title="Comunicação Organizacional"
        description="Comunicados, campanhas, mural, pesquisas, confirmações e chat corporativo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{data?.metrics.mandatoryPending ?? 0} ciência(s) pendente(s)</Badge>
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

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="mural"><Megaphone className="mr-2 h-4 w-4" />Meu Mural</TabsTrigger>
          <TabsTrigger value="central"><FileText className="mr-2 h-4 w-4" />Central</TabsTrigger>
          <TabsTrigger value="criar"><Plus className="mr-2 h-4 w-4" />Criar</TabsTrigger>
          <TabsTrigger value="campanhas"><Radio className="mr-2 h-4 w-4" />Campanhas</TabsTrigger>
          <TabsTrigger value="midias"><ImageIcon className="mr-2 h-4 w-4" />Mídias</TabsTrigger>
          <TabsTrigger value="metricas"><FileBarChart className="mr-2 h-4 w-4" />Métricas</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="mr-2 h-4 w-4" />Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="mural" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <WallList title="Pendências obrigatórias" posts={data?.myWall.mandatoryPending ?? []} onSelect={setSelectedPostId} />
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
          <WallList title="Recentes" posts={data?.myWall.recent ?? []} onSelect={setSelectedPostId} horizontal />
        </TabsContent>

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
            onSubmit={() => createPost.mutate()}
          />
        </TabsContent>

        <TabsContent value="campanhas" className="space-y-4">
          <CampaignsPanel campaigns={data?.campaigns ?? []} createCampaign={(payload) => createCampaign.mutate(payload)} />
        </TabsContent>

        <TabsContent value="midias" className="space-y-4">
          <MediaPanel media={data?.media ?? []} createMedia={(payload) => createMedia.mutate(payload)} />
        </TabsContent>

        <TabsContent value="metricas" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <EngagementCharts data={data} />
            <IntegrationSignals data={data} />
          </div>
          <MetricsPanel data={data} />
          <PostGrid posts={data?.charts.mostAccessed ?? []} onSelect={(post) => { setSelectedPostId(post.id); setTab('mural'); }} />
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
  const readByArea = data?.charts.readByArea.slice(0, 8) ?? [];
  const typeData = data?.charts.engagementByType ?? [];
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
        {post.videoUrl && (
          <div className="rounded-md border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PlaySquare className="h-4 w-4" />
              Vídeo vinculado
            </div>
            <Link href={post.videoUrl} target="_blank" className="mt-2 block break-all text-sm text-primary hover:underline">
              {post.videoUrl}
            </Link>
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
  onSubmit: () => void;
}

function CreatePostForm({ form, setForm, overview, aiPrompt, setAiPrompt, generateAi, saving, onSubmit }: CreatePostFormProps) {
  const users = overview?.audienceOptions.users ?? [];
  const areas = overview?.audienceOptions.areas ?? [];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Editor visual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
  const evolution = data?.charts.monthlyEvolution ?? [];
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
          {(data?.charts.pendingByManager ?? []).slice(0, 10).map((item) => (
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

function MediaPanel({ media, createMedia }: { media: MediaItem[]; createMedia: (payload: any) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.6fr_1fr]">
      <Card>
        <CardHeader><CardTitle>Biblioteca de mídias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Nome"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="URL"><Input value={url} onChange={(event) => setUrl(event.target.value)} /></Field>
          <Button onClick={() => name && createMedia({ name, url, type: 'IMAGE', category: 'Geral' })}>Adicionar mídia</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Acervo e modelos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {media.map((item) => (
            <div key={item.id} className="rounded-md border p-3">
              <p className="break-words font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.type} · {item.category}</p>
            </div>
          ))}
          {media.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mídia cadastrada.</p>}
        </CardContent>
      </Card>
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
