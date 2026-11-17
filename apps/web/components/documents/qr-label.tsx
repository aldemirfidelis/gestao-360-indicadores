'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

/**
 * Etiqueta com QR Code para o posto de trabalho: aponta para o modo leitura,
 * que sempre abre a revisão vigente (a etiqueta não precisa ser trocada a
 * cada revisão).
 */
export function QrLabelButton({ documentId, code, title }: { documentId: string; code: string | null; title: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    const target = `${window.location.origin}/documents/${documentId}/leitor`;
    setUrl(target);
    QRCode.toDataURL(target, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [open, documentId]);

  const print = () => {
    if (!dataUrl) return;
    const popup = window.open('', '_blank', 'width=480,height=640');
    if (!popup) return;
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(code ?? title)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;margin:0;display:flex;justify-content:center;padding:24px}
  .label{border:2px solid #111;border-radius:12px;padding:18px 20px;width:300px;text-align:center}
  .code{font-size:22px;font-weight:700;letter-spacing:.5px}
  .title{font-size:14px;margin:6px 0 10px}
  img{width:220px;height:220px}
  .hint{font-size:11px;color:#444;margin-top:8px}
</style></head><body><div class="label">
  <div class="code">${escapeHtml(code ?? 'Documento')}</div>
  <div class="title">${escapeHtml(title)}</div>
  <img src="${dataUrl}" alt="QR Code">
  <div class="hint">Aponte a câmera para ler a revisão vigente.</div>
</div><script>window.onload=function(){window.print();}</script></body></html>`);
    popup.document.close();
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <QrCode className="mr-1.5 h-4 w-4" /> QR Code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Etiqueta do posto de trabalho</DialogTitle>
            <DialogDescription>O QR Code abre sempre a revisão vigente, no celular ou tablet.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center">
            <p className="text-lg font-bold">{code ?? 'Documento'}</p>
            <p className="text-sm">{title}</p>
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt={`QR Code de ${code ?? title}`} className="h-52 w-52" />
            ) : (
              <div className="h-52 w-52 animate-pulse rounded bg-muted" />
            )}
            <p className="break-all text-[11px] text-muted-foreground">{url}</p>
          </div>
          <DialogFooter>
            <Button disabled={!dataUrl} onClick={print}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimir etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
