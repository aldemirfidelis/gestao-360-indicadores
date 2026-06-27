import type { LucideIcon } from 'lucide-react';
import { Boxes, Factory, PackageCheck, ShieldAlert, Truck, Warehouse } from 'lucide-react';

const stages: Array<{
  title: string;
  detail: string;
  icon: LucideIcon;
  left: string;
  top: string;
  tone: string;
  controlPoint?: boolean;
}> = [
  {
    title: 'Recebimento',
    detail: 'Matéria-prima',
    icon: Boxes,
    left: '9%',
    top: '66%',
    tone: 'border-sky-400/50 bg-sky-400/15 text-sky-200',
  },
  {
    title: 'Armazenamento',
    detail: 'Lotes e insumos',
    icon: Warehouse,
    left: '29%',
    top: '42%',
    tone: 'border-indigo-400/50 bg-indigo-400/15 text-indigo-200',
  },
  {
    title: 'Processamento',
    detail: 'Controle térmico',
    icon: Factory,
    left: '49%',
    top: '64%',
    tone: 'border-rose-400/60 bg-rose-400/15 text-rose-100',
    controlPoint: true,
  },
  {
    title: 'Embalagem',
    detail: 'Inspeção final',
    icon: PackageCheck,
    left: '69%',
    top: '39%',
    tone: 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100',
  },
  {
    title: 'Expedição',
    detail: 'Rastreabilidade',
    icon: Truck,
    left: '90%',
    top: '59%',
    tone: 'border-amber-300/50 bg-amber-300/15 text-amber-100',
  },
];

export function IsometricFoodFlowPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-emerald-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Fluxograma 3D</p>
          <p className="mt-1 text-sm font-semibold text-white">Linha de produção • Processo completo</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-300">
          <span className="rounded-full border border-white/10 px-2.5 py-1">Girar</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">Zoom</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">Reposicionar</span>
        </div>
      </div>

      <div
        className="relative hidden min-h-[390px] overflow-hidden sm:block"
        style={{
          backgroundColor: '#07101f',
          backgroundImage:
            'linear-gradient(30deg, rgba(52,211,153,0.08) 12%, transparent 12.5%, transparent 87%, rgba(52,211,153,0.08) 87.5%), linear-gradient(150deg, rgba(52,211,153,0.08) 12%, transparent 12.5%, transparent 87%, rgba(52,211,153,0.08) 87.5%)',
          backgroundSize: '48px 84px',
        }}
      >
        <div className="absolute inset-x-[4%] bottom-[8%] top-[18%] -skew-y-6 rounded-[32px] border border-emerald-300/10 bg-slate-900/45 shadow-[0_28px_80px_rgba(0,0,0,0.42)]" />

        <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 800 390" preserveAspectRatio="none">
          <defs>
            <marker id="flow-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="#6ee7b7" />
            </marker>
          </defs>
          <path d="M110 258 C175 258 175 170 228 170" fill="none" markerEnd="url(#flow-arrow)" stroke="#6ee7b7" strokeDasharray="7 7" strokeWidth="2" />
          <path d="M270 178 C325 185 330 250 388 250" fill="none" markerEnd="url(#flow-arrow)" stroke="#6ee7b7" strokeDasharray="7 7" strokeWidth="2" />
          <path d="M430 245 C490 235 492 165 548 160" fill="none" markerEnd="url(#flow-arrow)" stroke="#6ee7b7" strokeDasharray="7 7" strokeWidth="2" />
          <path d="M590 160 C665 165 666 226 716 226" fill="none" markerEnd="url(#flow-arrow)" stroke="#6ee7b7" strokeDasharray="7 7" strokeWidth="2" />
        </svg>

        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.title}
              className={`absolute w-[122px] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-3 shadow-[8px_12px_0_rgba(0,0,0,0.18)] backdrop-blur ${stage.tone}`}
              style={{ left: stage.left, top: stage.top }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-slate-950/50">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-semibold text-white/60">0{index + 1}</span>
              </div>
              <p className="mt-3 text-xs font-semibold text-white">{stage.title}</p>
              <p className="mt-1 text-[10px] text-slate-300">{stage.detail}</p>
              {stage.controlPoint && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
                  <ShieldAlert className="h-3 w-3" /> PCC
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 p-4 sm:hidden">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div key={stage.title} className={`flex items-center gap-3 rounded-xl border p-3 ${stage.tone}`}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-950/40">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white">{stage.title}</p>
                <p className="mt-0.5 text-[10px] text-slate-300">{stage.detail}</p>
              </div>
              <span className="text-[10px] font-semibold text-white/50">0{index + 1}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-slate-900/70 px-4 py-3 text-[11px] text-slate-300 sm:px-5">
        <span>Etapas conectadas aos perigos, controles e monitoramentos.</span>
        <span className="hidden items-center gap-1.5 font-semibold text-rose-300 sm:inline-flex">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
          PCC sinalizado
        </span>
      </div>
    </div>
  );
}
