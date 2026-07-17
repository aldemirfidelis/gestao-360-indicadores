'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/platform/loading-state';
import { api } from '@/lib/api';
import { qrDataUrl } from '@/lib/qr';

interface BadgeData {
  employee: { id: string; name: string; registrationId: string | null; jobName: string | null; areaName: string | null; admissionDate: string | null };
  company: { name: string; logoUrl: string | null };
  photo: { mimeType: string; contentBase64: string } | null;
  template: {
    accentColor: string; orientation: 'PORTRAIT' | 'LANDSCAPE';
    showPhoto: boolean; showQr: boolean; showJob: boolean; showAdmission: boolean; showRegistration: boolean;
    footerText: string | null;
  };
}

// Proporção do cartão ISO ID-1 (85,6 × 54 mm). Renderizamos em alta densidade.
const SCALE = 3;
const PORTRAIT = { w: 340, h: 540 };
const LANDSCAPE = { w: 540, h: 340 };

export function BadgeDialog({ employeeId, open, onClose }: { employeeId: string | null; open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!open || !employeeId) return;
    let active = true;
    setLoading(true);
    setData(null);
    api<BadgeData>(`/personnel/employees/${employeeId}/badge`)
      .then((d) => { if (active) setData(d); })
      .catch((e: any) => toast.error(e?.message ?? 'Não foi possível carregar os dados do crachá.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, employeeId]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    setRendering(true);
    try {
      const landscape = data.template.orientation === 'LANDSCAPE';
      const dims = landscape ? LANDSCAPE : PORTRAIT;
      canvas.width = dims.w * SCALE;
      canvas.height = dims.h * SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.clearRect(0, 0, dims.w, dims.h);

      const accent = safeColor(data.template.accentColor);
      const [logo, photo, qr] = await Promise.all([
        loadImage(data.company.logoUrl),
        data.template.showPhoto && data.photo ? loadImage(`data:${data.photo.mimeType};base64,${data.photo.contentBase64}`) : Promise.resolve(null),
        data.template.showQr && data.employee.registrationId ? qrDataUrl(data.employee.registrationId, { size: 240 }).then(loadImage).catch(() => null) : Promise.resolve(null),
      ]);

      // Fundo
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dims.w, dims.h);
      // Borda
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      roundRect(ctx, 0.5, 0.5, dims.w - 1, dims.h - 1, 14);
      ctx.stroke();

      if (landscape) drawLandscape(ctx, dims, data, accent, logo, photo, qr);
      else drawPortrait(ctx, dims, data, accent, logo, photo, qr);
    } finally {
      setRendering(false);
    }
  }, [data]);

  useEffect(() => { void draw(); }, [draw]);

  const download = (format: 'png' | 'jpeg') => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    try {
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const url = canvas.toDataURL(mime, 0.96);
      triggerDownload(url, `cracha-${slug(data.employee.name)}.${format}`);
    } catch {
      toast.error('Não foi possível exportar. Se o logo da empresa for de outro site, substitua por uma imagem enviada na plataforma.');
    }
  };

  const downloadPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    try {
      const landscape = data.template.orientation === 'LANDSCAPE';
      const dims = landscape ? LANDSCAPE : PORTRAIT;
      const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'px', format: [dims.w, dims.h] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, dims.w, dims.h);
      pdf.save(`cracha-${slug(data.employee.name)}.pdf`);
    } catch {
      toast.error('Não foi possível gerar o PDF.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Crachá de identificação</DialogTitle></DialogHeader>
        {loading && <LoadingState label="Carregando dados..." />}
        {!loading && data && (
          <div className="space-y-4">
            {!data.employee.registrationId && (
              <p className="rounded-md border border-status-yellow/30 bg-status-yellow/5 p-2 text-xs text-status-yellow">
                Este colaborador está sem matrícula — o QR e o número não aparecem. Configure a numeração em Serviço Pessoal → Configurações.
              </p>
            )}
            <div className="flex justify-center rounded-lg bg-muted/30 p-4">
              <canvas
                ref={canvasRef}
                className="rounded-lg shadow-md"
                style={{ width: (data.template.orientation === 'LANDSCAPE' ? LANDSCAPE.w : PORTRAIT.w) * 0.7, height: (data.template.orientation === 'LANDSCAPE' ? LANDSCAPE.h : PORTRAIT.h) * 0.7 }}
              />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={downloadPdf} disabled={rendering}>Baixar PDF</Button>
              <Button size="sm" variant="outline" onClick={() => download('png')} disabled={rendering}>PNG</Button>
              <Button size="sm" variant="outline" onClick={() => download('jpeg')} disabled={rendering}>JPEG</Button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              O modelo (cores, campos, orientação e logo) é definido em Serviço Pessoal → Configurações.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function drawPortrait(
  ctx: CanvasRenderingContext2D,
  dims: { w: number; h: number },
  data: BadgeData,
  accent: string,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  qr: HTMLImageElement | null,
) {
  // Faixa superior
  ctx.fillStyle = accent;
  roundRectTop(ctx, 0, 0, dims.w, 64, 14);
  ctx.fill();
  if (logo) drawContain(ctx, logo, 14, 12, 40, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = logo ? 'left' : 'center';
  ctx.fillText(truncate(ctx, data.company.name, dims.w - (logo ? 74 : 28)), logo ? 64 : dims.w / 2, 39);

  // Foto
  let y = 90;
  if (data.template.showPhoto) {
    const size = 130;
    const x = (dims.w - size) / 2;
    ctx.save();
    roundRect(ctx, x, y, size, size, 12);
    ctx.clip();
    if (photo) drawCover(ctx, photo, x, y, size, size);
    else { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x, y, size, size); drawInitials(ctx, data.employee.name, x, y, size); }
    ctx.restore();
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    roundRect(ctx, x, y, size, size, 12); ctx.stroke();
    y += size + 22;
  }

  // Nome + cargo
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText(truncate(ctx, data.employee.name, dims.w - 28), dims.w / 2, y);
  y += 24;
  if (data.template.showJob && data.employee.jobName) {
    ctx.fillStyle = '#475569';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText(truncate(ctx, data.employee.jobName, dims.w - 28), dims.w / 2, y);
    y += 22;
  }

  // Matrícula
  if (data.template.showRegistration && data.employee.registrationId) {
    y += 6;
    ctx.fillStyle = '#64748b';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText('MATRÍCULA', dims.w / 2, y);
    y += 20;
    ctx.fillStyle = accent;
    ctx.font = '700 24px ui-monospace, monospace';
    ctx.fillText(data.employee.registrationId, dims.w / 2, y);
    y += 16;
  }
  if (data.template.showAdmission && data.employee.admissionDate) {
    y += 14;
    ctx.fillStyle = '#64748b';
    ctx.font = '400 12px system-ui, sans-serif';
    ctx.fillText(`Admissão: ${formatDate(data.employee.admissionDate)}`, dims.w / 2, y);
  }

  // QR
  if (qr) {
    const qs = 92;
    drawContain(ctx, qr, (dims.w - qs) / 2, dims.h - qs - 46, qs, qs);
  }
  drawFooter(ctx, dims, data, accent);
}

function drawLandscape(
  ctx: CanvasRenderingContext2D,
  dims: { w: number; h: number },
  data: BadgeData,
  accent: string,
  logo: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  qr: HTMLImageElement | null,
) {
  ctx.fillStyle = accent;
  roundRectTop(ctx, 0, 0, dims.w, 52, 14);
  ctx.fill();
  if (logo) drawContain(ctx, logo, 14, 8, 36, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = logo ? 'left' : 'center';
  ctx.fillText(truncate(ctx, data.company.name, dims.w - (logo ? 70 : 28)), logo ? 58 : dims.w / 2, 32);

  const left = 24;
  let py = 78;
  if (data.template.showPhoto) {
    const size = 120;
    ctx.save();
    roundRect(ctx, left, py, size, size, 12);
    ctx.clip();
    if (photo) drawCover(ctx, photo, left, py, size, size);
    else { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(left, py, size, size); drawInitials(ctx, data.employee.name, left, py, size); }
    ctx.restore();
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    roundRect(ctx, left, py, size, size, 12); ctx.stroke();
  }

  const tx = data.template.showPhoto ? 160 : left;
  let ty = 96;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText(truncate(ctx, data.employee.name, dims.w - tx - 20), tx, ty);
  ty += 22;
  if (data.template.showJob && data.employee.jobName) {
    ctx.fillStyle = '#475569';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(truncate(ctx, data.employee.jobName, dims.w - tx - 20), tx, ty);
    ty += 24;
  }
  if (data.template.showRegistration && data.employee.registrationId) {
    ctx.fillStyle = '#64748b'; ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillText('MATRÍCULA', tx, ty); ty += 20;
    ctx.fillStyle = accent; ctx.font = '700 22px ui-monospace, monospace';
    ctx.fillText(data.employee.registrationId, tx, ty); ty += 8;
  }
  if (data.template.showAdmission && data.employee.admissionDate) {
    ty += 16; ctx.fillStyle = '#64748b'; ctx.font = '400 12px system-ui, sans-serif';
    ctx.fillText(`Admissão: ${formatDate(data.employee.admissionDate)}`, tx, ty);
  }
  if (qr) drawContain(ctx, qr, dims.w - 96, dims.h - 96, 78, 78);
  drawFooter(ctx, dims, data, accent);
}

function drawFooter(ctx: CanvasRenderingContext2D, dims: { w: number; h: number }, data: BadgeData, accent: string) {
  if (!data.template.footerText) return;
  ctx.fillStyle = accent;
  roundRectBottom(ctx, 0, dims.h - 26, dims.w, 26, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(truncate(ctx, data.template.footerText, dims.w - 24), dims.w / 2, dims.h - 9);
}

// ---------- helpers de desenho ----------

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.min(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function drawInitials(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  ctx.fillStyle = '#94a3b8';
  ctx.font = `700 ${size * 0.32}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, x + size / 2, y + size / 2);
  ctx.textBaseline = 'alphabetic';
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
function roundRectBottom(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.closePath();
}
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}
function safeColor(value: string | null | undefined): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#0ea5e9';
}
function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('pt-BR') : value;
}
function slug(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'colaborador';
}
function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
