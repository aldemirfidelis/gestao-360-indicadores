'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Linkedin, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { linkedInShareUrl, vacancyPostText } from '@/lib/recruitment/share';
import { WORK_MODE, labelOf } from '@/lib/recruitment/labels';
// O rótulo de contratação só existe no módulo do portal público.
import { CONTRACT_LABEL } from '@/lib/careers';

/**
 * Compartilhar a vaga no LinkedIn.
 *
 * O LinkedIn não aceita texto pré-preenchido — ele monta o card lendo as tags
 * Open Graph da página da vaga (ver `generateMetadata` em
 * `app/carreiras/vagas/[slug]/page.tsx`). O que dá para adiantar é o comentário
 * do post: montamos um texto sugerido, o recrutador revisa, copia e cola.
 */
export function ShareVacancyButton({
  title,
  companyName,
  city,
  workMode,
  contractType,
  vacancyPath,
}: {
  title: string;
  companyName?: string | null;
  city?: string | null;
  workMode?: string | null;
  contractType?: string | null;
  /** Caminho público da vaga, ex. `/carreiras/vagas/gestor?empresa=goiasa`. */
  vacancyPath: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');

  function prepare() {
    const url = `${window.location.origin}${vacancyPath}`;
    setText(
      vacancyPostText({
        title,
        companyName,
        city,
        workModeLabel: workMode ? labelOf(WORK_MODE, workMode) : null,
        contractLabel: contractType ? labelOf(CONTRACT_LABEL, contractType) : null,
        url,
      }),
    );
    setCopied(false);
    setOpen(true);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Texto copiado. Cole no LinkedIn ao publicar.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  }

  function openLinkedIn() {
    const url = `${window.location.origin}${vacancyPath}`;
    window.open(linkedInShareUrl(url), '_blank', 'noopener,noreferrer,width=720,height=640');
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={prepare}>
        <Linkedin className="mr-1 h-3.5 w-3.5" /> Compartilhar no LinkedIn
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compartilhar vaga no LinkedIn</DialogTitle>
            <DialogDescription>
              O LinkedIn monta o card da vaga (cargo, empresa e imagem) a partir do link. O texto abaixo é a sugestão de
              publicação — revise, copie e cole ao publicar.
            </DialogDescription>
          </DialogHeader>

          <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} className="text-sm" />

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={copyText}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5 text-status-green" /> : <Share2 className="mr-1 h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar texto'}
            </Button>
            <Button onClick={openLinkedIn}>
              <Linkedin className="mr-1 h-3.5 w-3.5" /> Abrir o LinkedIn
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
