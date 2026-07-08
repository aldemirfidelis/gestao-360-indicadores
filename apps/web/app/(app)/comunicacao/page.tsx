'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import type { ConversationSummary } from '@/lib/communication/types';
import {
  audienceLabel,
  defaultForm,
  formPayload,
  isCommunicationTab,
  type CommunicationOverview,
  type CommunicationTab,
  type MediaItem,
  type MediaUploadPayload,
  type PostStatus,
} from '@/components/communication/organizational/shared';
import { Dashboard, EngagementCharts, IntegrationSignals, MetricsPanel } from '@/components/communication/organizational/overview-panels';
import { CommunicationTable, PostDetail, PostGrid } from '@/components/communication/organizational/post-views';
import { CreatePostForm } from '@/components/communication/organizational/create-post-form';
import { CampaignsPanel, MediaPanel } from '@/components/communication/organizational/campaigns-media';
import { ChatWorkspace } from '@/components/communication/organizational/chat-workspace';
import { CommunicationDashboardView } from '@/components/communication/organizational/dashboard-view';

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
