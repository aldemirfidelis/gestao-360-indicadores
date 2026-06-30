'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { buildScanUrl, qrDataUrl, type QrType } from '@/lib/qr';

/**
 * Diálogo reusável que mostra o QR Code de um token (checkpoint / formulário /
 * ocorrência) e permite imprimir a etiqueta para colar no local físico.
 */
export function QrPrintDialog({
  open,
  onOpenChange,
  type,
  token,
  title,
  subtitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: QrType;
  token: string | null;
  title: string;
  subtitle?: string;
}) {
  const [img, setImg] = useState<string | null>(null);
  const url = token ? buildScanUrl(type, token) : '';

  useEffect(() => {
    let alive = true;
    setImg(null);
    if (open && token) {
      void qrDataUrl(url).then((d) => { if (alive) setImg(d); });
    }
    return () => { alive = false; };
  }, [open, token, url]);

  function print() {
    if (!img) return;
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return;
    const safeTitle = title.replace(/</g, '&lt;');
    const safeSub = (subtitle ?? '').replace(/</g, '&lt;');
    w.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${safeTitle}</title>` +
      '<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}' +
      '.card{text-align:center;padding:24px;border:2px solid #0f172a;border-radius:16px}' +
      'img{width:300px;height:300px}h2{margin:14px 0 2px;font-size:18px}p{margin:0;color:#475569;font-size:13px}</style></head>' +
      `<body><div class="card"><img src="${img}" alt="QR"/><h2>${safeTitle}</h2>${safeSub ? `<p>${safeSub}</p>` : ''}</div>` +
      '<script>window.onload=function(){setTimeout(function(){window.print();},150);}</script></body></html>',
    );
    w.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code — {title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {img ? (
            <img src={img} alt="QR Code" className="h-56 w-56 rounded-lg border" />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded-lg bg-muted" />
          )}
          {subtitle && <p className="text-center text-xs text-muted-foreground">{subtitle}</p>}
          <p className="break-all text-center text-[10px] text-muted-foreground">{url}</p>
          <p className="text-center text-[11px] text-muted-foreground">
            Imprima e cole no local. Aponte a câmera do celular para escanear.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={print} disabled={!img}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
