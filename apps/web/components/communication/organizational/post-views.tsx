'use client';

// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
import Link from 'next/link';
import { BookOpenCheck, CheckCircle2, MessageCircle, Megaphone, PlaySquare, QrCode, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatDate, formatPercent } from '@/lib/utils';
import { isPlayableVideoUrl, STATUS_LABEL, TYPE_LABEL, type CommunicationPost, type PostStatus } from './shared';
import { PriorityBadge, SmallFact } from './shared-widgets';
import { DataTable, type ColumnDef } from '@/components/platform/data-table';

export function PostGrid({ posts, onSelect }: { posts: CommunicationPost[]; onSelect: (post: CommunicationPost) => void }) {
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

export function PostCard({ post, onClick }: { post: CommunicationPost; onClick: () => void }) {
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

export function WallList({ title, posts, onSelect, horizontal = false }: { title: string; posts: CommunicationPost[]; onSelect: (id: string) => void; horizontal?: boolean }) {
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

export function PostDetail({
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

export function CommunicationTable({ posts, onSelect, onStatus }: { posts: CommunicationPost[]; onSelect: (post: CommunicationPost) => void; onStatus: (id: string, status: PostStatus) => void }) {
  // Tabela padrão da plataforma: busca, ordenação e paginação vêm do DataTable.
  const columns: ColumnDef<CommunicationPost, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Título',
      cell: ({ row }) => (
        <div className="max-w-72">
          <button onClick={() => onSelect(row.original)} className="break-words text-left font-medium hover:underline">
            {row.original.title}
          </button>
          <p className="text-xs text-muted-foreground">{row.original.category}</p>
        </div>
      ),
    },
    { accessorKey: 'type', header: 'Tipo', cell: ({ row }) => TYPE_LABEL[row.original.type] },
    { accessorKey: 'priority', header: 'Prioridade', cell: ({ row }) => <PriorityBadge priority={row.original.priority} /> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="secondary">{STATUS_LABEL[row.original.status]}</Badge> },
    { accessorKey: 'audienceSize', header: 'Público' },
    { accessorKey: 'readRate', header: 'Leitura', cell: ({ row }) => formatPercent(row.original.readRate) },
    { accessorKey: 'confirmationRate', header: 'Ciência', cell: ({ row }) => formatPercent(row.original.confirmationRate) },
    { accessorKey: 'expiresAt', header: 'Validade', cell: ({ row }) => formatDate(row.original.expiresAt) },
    {
      id: 'actions',
      header: 'Ações',
      enableSorting: false,
      cell: ({ row }) => {
        const post = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            {post.status !== 'PUBLISHED' && <Button size="sm" variant="outline" onClick={() => onStatus(post.id, 'PUBLISHED')}>Publicar</Button>}
            {post.status === 'DRAFT' && <Button size="sm" variant="outline" onClick={() => onStatus(post.id, 'PENDING_APPROVAL')}>Aprovação</Button>}
            {post.status === 'PUBLISHED' && <Button size="sm" variant="outline" onClick={() => onStatus(post.id, 'ARCHIVED')}>Arquivar</Button>}
          </div>
        );
      },
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Central de Comunicados</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={posts}
          searchPlaceholder="Buscar comunicado..."
          emptyTitle="Nenhum comunicado cadastrado"
          emptyDescription="Crie o primeiro comunicado na aba Criar."
          className="border-0 shadow-none"
        />
      </CardContent>
    </Card>
  );
}
