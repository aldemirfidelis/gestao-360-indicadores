'use client';

// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, FileUp, Film, Image as ImageIcon, ImagePlus, Link2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { isImageMedia, isPlayableVideoUrl, isVideoMedia, type Campaign, type MediaItem, type MediaUploadPayload, type UploadMediaFn } from './shared';
import { Field } from './shared-widgets';
import { MediaAssetUploader } from './create-post-form';
import { MediaPreview } from './media-preview';

export function CampaignsPanel({ campaigns, createCampaign }: { campaigns: Campaign[]; createCampaign: (payload: any) => void }) {
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


export function MediaPanel({
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

export { MediaPreview };

