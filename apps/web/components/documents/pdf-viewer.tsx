'use client';

/**
 * Visualizador de PDF somente leitura da plataforma (estilo WebViewer).
 *
 * Construído sobre o pdf.js (mesmo motor do Firefox). Recursos:
 * - Transição de página: contínuo ou página por página
 * - Layout: página única, página dupla e capa (primeira página isolada)
 * - Rotação horário/anti-horário, zoom (ajustar à largura/página + níveis)
 * - Miniaturas laterais, busca com destaque (insensível a acento/caixa)
 * - Ferramentas de seleção de texto e mão (arrastar para rolar), tela cheia
 *
 * O documento nunca é editável: as páginas são rasterizadas em canvas e a
 * camada de texto existe apenas para seleção/busca.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns2,
  Download,
  File,
  GalleryVertical,
  Hand,
  Maximize,
  Minimize,
  PanelLeft,
  RotateCcw,
  RotateCw,
  Search,
  SlidersHorizontal,
  StickyNote,
  TextCursor,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { findMatchStarts, normalizeSearchable, resolveMatchPosition } from './pdf-search';
import './pdf-viewer.css';

if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
}

type ZoomSetting = 'fit-width' | 'fit-page' | number;
type ScrollMode = 'continuous' | 'paged';
type PageLayout = 'single' | 'double' | 'cover';
type Tool = 'select' | 'pan';

interface PageDims {
  w: number;
  h: number;
}

export interface PdfViewerProps {
  /** URL (inclusive blob:) ou dados binários do PDF. */
  src: string | Blob | ArrayBuffer;
  fileName?: string;
  className?: string;
  /** Quando informado, exibe o botão de download na barra. */
  onDownload?: () => void;
}

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const PAGE_GAP = 16;
const CONTENT_PADDING = 48;
const MAX_DPR = 2;

/* ------------------------------------------------------------------ */
/* Destaque de busca sobre a camada de texto                           */
/* ------------------------------------------------------------------ */

function clearHighlights(container: HTMLElement) {
  const marks = Array.from(container.querySelectorAll('mark.pdfv-mark'));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    mark.remove();
    parent.normalize();
  }
}

/**
 * Envolve cada ocorrência da consulta em <mark>. Uma ocorrência pode gerar
 * vários <mark> quando atravessa mais de um nó de texto; por isso o retorno
 * é uma lista de grupos (um grupo por ocorrência, em ordem do documento).
 */
function applyHighlights(container: HTMLElement, foldedQuery: string): HTMLElement[][] {
  clearHighlights(container);
  if (!foldedQuery) return [];

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const offsets: number[] = [];
  let full = '';
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const text = current as Text;
    nodes.push(text);
    offsets.push(full.length);
    full += text.nodeValue ?? '';
  }

  const starts = findMatchStarts(normalizeSearchable(full), foldedQuery);
  const groups: HTMLElement[][] = [];

  // Processa da última para a primeira para que os índices já visitados
  // não sejam invalidados pelas divisões de nós feitas pelo surroundContents.
  for (let m = starts.length - 1; m >= 0; m--) {
    const start = starts[m];
    const end = start + foldedQuery.length;
    const group: HTMLElement[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const nodeStart = offsets[i];
      if (nodeStart >= end) break;
      const target = nodes[i];
      const nodeEnd = nodeStart + (target.nodeValue?.length ?? 0);
      if (nodeEnd <= start) continue;
      const from = Math.max(0, start - nodeStart);
      const to = Math.min(nodeEnd, end) - nodeStart;
      if (to <= from) continue;
      const range = document.createRange();
      range.setStart(target, from);
      range.setEnd(target, to);
      const mark = document.createElement('mark');
      mark.className = 'pdfv-mark';
      try {
        range.surroundContents(mark);
        group.push(mark);
      } catch {
        // Nó alterado de forma inesperada; ignora esta fatia.
      }
    }
    if (group.length > 0) groups.unshift(group);
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Página (canvas + camada de texto)                                   */
/* ------------------------------------------------------------------ */

interface PdfPageViewProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  cssWidth: number;
  cssHeight: number;
  scale: number;
  rotation: number;
  scrollRoot: HTMLElement | null;
  /** No modo página por página a página visível renderiza sem observer. */
  eager: boolean;
  onTextLayer: (pageNumber: number, el: HTMLElement | null) => void;
}

function PdfPageView({ doc, pageNumber, cssWidth, cssHeight, scale, rotation, scrollRoot, eager, onTextLayer }: PdfPageViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager) {
      setVisible(true);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { root: scrollRoot, rootMargin: '700px 0px 700px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, scrollRoot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textDiv = textRef.current;
    if (!canvas || !textDiv) return;

    if (!visible) {
      // Libera memória de páginas fora da janela de rolagem.
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.display = 'none';
      textDiv.replaceChildren();
      onTextLayer(pageNumber, null);
      return;
    }

    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null = null;
    let textLayer: InstanceType<typeof pdfjs.TextLayer> | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.display = 'block';
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await renderTask.promise;
        if (cancelled) return;

        textDiv.replaceChildren();
        textDiv.style.setProperty('--scale-factor', String(viewport.scale));
        textLayer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textDiv,
          viewport,
        });
        await textLayer.render();
        if (cancelled) return;
        onTextLayer(pageNumber, textDiv);
      } catch (error) {
        if ((error as Error | null)?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error(`Falha ao renderizar página ${pageNumber} do PDF`, error);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      onTextLayer(pageNumber, null);
    };
  }, [visible, doc, pageNumber, scale, rotation, onTextLayer]);

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="relative shrink-0 bg-white shadow-md ring-1 ring-black/10"
      style={{ width: Math.floor(cssWidth), height: Math.floor(cssHeight) }}
    >
      <canvas ref={canvasRef} className="absolute left-0 top-0" />
      <div ref={textRef} className="pdfv-textlayer" />
      {!visible && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400">{pageNumber}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Miniatura                                                           */
/* ------------------------------------------------------------------ */

interface ThumbnailProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  dims: PageDims;
  rotation: number;
  active: boolean;
  scrollRoot: HTMLElement | null;
  onSelect: (page: number) => void;
}

function PdfThumbnail({ doc, pageNumber, dims, rotation, active, scrollRoot, onSelect }: ThumbnailProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  const rotated = rotation % 180 !== 0;
  const baseW = rotated ? dims.h : dims.w;
  const baseH = rotated ? dims.w : dims.h;
  const width = 96;
  const height = Math.max(24, Math.round((baseH / baseW) * width));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setVisible(true);
      },
      { root: scrollRoot, rootMargin: '300px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const scale = (width / baseW) * 1.5;
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;
      } catch (error) {
        if ((error as Error | null)?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error(`Falha ao renderizar miniatura ${pageNumber}`, error);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [visible, doc, pageNumber, rotation, baseW, width]);

  return (
    <button
      ref={ref}
      type="button"
      data-thumb={pageNumber}
      onClick={() => onSelect(pageNumber)}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-accent',
        active && 'bg-accent ring-1 ring-primary/50',
      )}
      title={`Página ${pageNumber}`}
    >
      <span className="block bg-white shadow ring-1 ring-black/10" style={{ width, height }}>
        <canvas ref={canvasRef} className="h-full w-full" />
      </span>
      <span className={cn('text-[10px]', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{pageNumber}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Botão de barra                                                      */
/* ------------------------------------------------------------------ */

interface ToolButtonProps {
  title: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

function ToolButton({ title, onClick, active, disabled, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

interface MenuItemProps {
  onSelect: () => void;
  selected?: boolean;
  icon: ReactNode;
  children: ReactNode;
  /** Por padrão o menu permanece aberto (permite ajustar várias opções). */
  closeOnSelect?: boolean;
}

function MenuItem({ onSelect, selected, icon, children, closeOnSelect }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      onSelect={(event) => {
        if (!closeOnSelect) event.preventDefault();
        onSelect();
      }}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{children}</span>
      {selected && <Check className="h-3.5 w-3.5 text-primary" />}
    </DropdownMenu.Item>
  );
}

const menuContentClass =
  'z-[90] min-w-[230px] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg';

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export function PdfViewer({ src, fileName, className, onDownload }: PdfViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageDims, setPageDims] = useState<PageDims[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState<ZoomSetting>('fit-width');
  const [rotation, setRotation] = useState(0);
  const [scrollMode, setScrollMode] = useState<ScrollMode>('continuous');
  const [layout, setLayout] = useState<PageLayout>('single');
  const [tool, setTool] = useState<Tool>('select');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panning, setPanning] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [thumbsEl, setThumbsEl] = useState<HTMLElement | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<{ query: string; folded: string } | null>(null);
  const [matchCounts, setMatchCounts] = useState<number[] | null>(null);
  const [activeMatch, setActiveMatch] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [layerVersion, setLayerVersion] = useState(0);

  const textLayersRef = useRef(new Map<number, HTMLElement>());
  const markGroupsRef = useRef(new Map<number, HTMLElement[][]>());
  const pageTextsRef = useRef<string[] | null>(null);
  const spreadElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const panStateRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const flipLockRef = useRef(0);

  const numPages = doc?.numPages ?? 0;

  /* ----- carregamento do documento ----- */
  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null;
    setDoc(null);
    setPageDims([]);
    setLoadError(null);
    setProgress(0);
    setCurrentPage(1);
    setPageInput('1');
    setSearch(null);
    setMatchCounts(null);
    setActiveMatch(-1);
    setSearchInput('');
    pageTextsRef.current = null;
    textLayersRef.current.clear();
    markGroupsRef.current.clear();

    (async () => {
      try {
        const params =
          typeof src === 'string'
            ? { url: src }
            : src instanceof Blob
              ? { data: await src.arrayBuffer() }
              : { data: src };
        if (cancelled) return;
        loadingTask = pdfjs.getDocument(params);
        loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (total > 0 && !cancelled) setProgress(Math.min(99, Math.round((loaded / total) * 100)));
        };
        const loaded = await loadingTask.promise;
        if (cancelled) return;
        const dims: PageDims[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const page = await loaded.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          dims.push({ w: viewport.width, h: viewport.height });
          if (cancelled) return;
        }
        setPageDims(dims);
        setDoc(loaded);
        setProgress(100);
      } catch (error) {
        if (!cancelled) {
          console.error('Falha ao abrir PDF', error);
          setLoadError('Não foi possível abrir o PDF para visualização.');
        }
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy().catch(() => undefined);
    };
  }, [src]);

  /* ----- medidas do contêiner ----- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollEl(el);
    const observer = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    observer.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, [doc]);

  useEffect(() => {
    setThumbsEl(thumbsRef.current);
  }, [sidebarOpen, doc]);

  /* ----- grupos de páginas (spreads) conforme layout ----- */
  const spreads = useMemo(() => {
    const groups: number[][] = [];
    if (numPages === 0) return groups;
    if (layout === 'single') {
      for (let i = 1; i <= numPages; i++) groups.push([i]);
      return groups;
    }
    let start = 1;
    if (layout === 'cover') {
      groups.push([1]);
      start = 2;
    }
    for (let i = start; i <= numPages; i += 2) {
      groups.push(i + 1 <= numPages ? [i, i + 1] : [i]);
    }
    return groups;
  }, [numPages, layout]);

  const spreadIndexOfPage = useCallback(
    (page: number) => {
      const idx = spreads.findIndex((group) => group.includes(page));
      return idx === -1 ? 0 : idx;
    },
    [spreads],
  );

  /* ----- escala efetiva ----- */
  const scale = useMemo(() => {
    if (typeof zoom === 'number') return zoom;
    if (!containerSize.w || pageDims.length === 0 || spreads.length === 0) return 1;
    const rotated = rotation % 180 !== 0;
    const widthOf = (d: PageDims) => (rotated ? d.h : d.w);
    const heightOf = (d: PageDims) => (rotated ? d.w : d.h);
    let maxSpreadWidth = 0;
    for (const group of spreads) {
      const w = group.reduce((sum, p) => sum + widthOf(pageDims[p - 1]), 0) + (group.length - 1) * PAGE_GAP;
      maxSpreadWidth = Math.max(maxSpreadWidth, w);
    }
    let maxPageHeight = 0;
    for (const d of pageDims) maxPageHeight = Math.max(maxPageHeight, heightOf(d));
    const fitWidth = (containerSize.w - CONTENT_PADDING) / maxSpreadWidth;
    if (zoom === 'fit-width') return Math.min(Math.max(fitWidth, 0.1), 5);
    const fitPage = Math.min(fitWidth, (containerSize.h - CONTENT_PADDING) / maxPageHeight);
    return Math.min(Math.max(fitPage, 0.1), 5);
  }, [zoom, containerSize, pageDims, spreads, rotation]);

  const pageCssSize = useCallback(
    (page: number) => {
      const dims = pageDims[page - 1] ?? { w: 595, h: 842 };
      const rotated = rotation % 180 !== 0;
      return {
        width: (rotated ? dims.h : dims.w) * scale,
        height: (rotated ? dims.w : dims.h) * scale,
      };
    },
    [pageDims, rotation, scale],
  );

  /* ----- mantém o ponto central ao trocar o zoom ----- */
  const prevScaleRef = useRef(scale);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const prev = prevScaleRef.current;
    prevScaleRef.current = scale;
    if (!el || !prev || prev === scale || scrollMode !== 'continuous') return;
    const factor = scale / prev;
    el.scrollTop = (el.scrollTop + el.clientHeight / 2) * factor - el.clientHeight / 2;
    el.scrollLeft = (el.scrollLeft + el.clientWidth / 2) * factor - el.clientWidth / 2;
  }, [scale, scrollMode]);

  /* ----- navegação ----- */
  // Rolagem manual (em vez de scrollIntoView) para não arrastar contêineres
  // roláveis externos, como o Dialog que hospeda o visualizador.
  const goToPage = useCallback(
    (page: number) => {
      if (!numPages) return;
      const clamped = Math.min(Math.max(page, 1), numPages);
      setCurrentPage(clamped);
      const scroll = scrollRef.current;
      if (scrollMode === 'continuous' && scroll) {
        const idx = spreadIndexOfPage(clamped);
        const spreadEl = spreadElsRef.current[idx];
        if (spreadEl) scroll.scrollTop = Math.max(0, spreadEl.offsetTop - PAGE_GAP);
      } else {
        scroll?.scrollTo({ top: 0 });
      }
    },
    [numPages, scrollMode, spreadIndexOfPage],
  );

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const currentSpreadIdx = spreadIndexOfPage(currentPage);
  const goToSpread = useCallback(
    (delta: number) => {
      const next = Math.min(Math.max(currentSpreadIdx + delta, 0), spreads.length - 1);
      if (next !== currentSpreadIdx) goToPage(spreads[next][0]);
    },
    [currentSpreadIdx, spreads, goToPage],
  );

  /* ----- página corrente durante rolagem contínua ----- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrollMode !== 'continuous') return;
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = el.scrollTop + el.clientHeight / 2;
        let best = 0;
        let bestDist = Infinity;
        spreadElsRef.current.forEach((spreadEl, idx) => {
          if (!spreadEl) return;
          const mid = spreadEl.offsetTop + spreadEl.offsetHeight / 2;
          const dist = Math.abs(mid - center);
          if (dist < bestDist) {
            bestDist = dist;
            best = idx;
          }
        });
        const page = spreads[best]?.[0];
        if (page) setCurrentPage((prev) => (prev === page || spreads[best].includes(prev) ? prev : page));
      });
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', handler);
    };
  }, [scrollMode, spreads]);

  /* ----- zoom ----- */
  const zoomIn = useCallback(() => {
    setZoom(ZOOM_STEPS.find((s) => s > scale + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]);
  }, [scale]);
  const zoomOut = useCallback(() => {
    setZoom([...ZOOM_STEPS].reverse().find((s) => s < scale - 0.001) ?? ZOOM_STEPS[0]);
  }, [scale]);

  const zoomHandlersRef = useRef({ zoomIn, zoomOut });
  zoomHandlersRef.current = { zoomIn, zoomOut };
  const pagedStateRef = useRef({ scrollMode, goToSpread });
  pagedStateRef.current = { scrollMode, goToSpread };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (event.deltaY < 0) zoomHandlersRef.current.zoomIn();
        else zoomHandlersRef.current.zoomOut();
        return;
      }
      const { scrollMode: mode, goToSpread: flip } = pagedStateRef.current;
      if (mode !== 'paged') return;
      const now = Date.now();
      if (now - flipLockRef.current < 350) return;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      const atTop = el.scrollTop <= 2;
      if (event.deltaY > 0 && atBottom) {
        flipLockRef.current = now;
        flip(1);
      } else if (event.deltaY < 0 && atTop) {
        flipLockRef.current = now;
        flip(-1);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [doc]);

  /* ----- tela cheia ----- */
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen?.();
    }
  }, []);

  /* ----- rotação ----- */
  const rotate = useCallback((delta: number) => {
    setRotation((prev) => (((prev + delta) % 360) + 360) % 360);
  }, []);

  /* ----- ferramenta mão ----- */
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (tool !== 'pan' || event.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;
      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      panStateRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: el.scrollLeft,
        top: el.scrollTop,
      };
      setPanning(true);
    },
    [tool],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current;
    const el = scrollRef.current;
    if (!state || !el || state.pointerId !== event.pointerId) return;
    el.scrollLeft = state.left - (event.clientX - state.x);
    el.scrollTop = state.top - (event.clientY - state.y);
  }, []);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    panStateRef.current = null;
    setPanning(false);
    scrollRef.current?.releasePointerCapture(event.pointerId);
  }, []);

  /* ----- registro das camadas de texto (para busca) ----- */
  const handleTextLayer = useCallback((pageNumber: number, el: HTMLElement | null) => {
    if (el) {
      textLayersRef.current.set(pageNumber, el);
      setLayerVersion((v) => v + 1);
    } else {
      textLayersRef.current.delete(pageNumber);
      markGroupsRef.current.delete(pageNumber);
    }
  }, []);

  /* ----- busca ----- */
  const totalMatches = useMemo(
    () => (matchCounts ? matchCounts.reduce((sum, c) => sum + c, 0) : 0),
    [matchCounts],
  );

  const ensurePageTexts = useCallback(async (document: PDFDocumentProxy) => {
    if (pageTextsRef.current) return pageTextsRef.current;
    const texts: string[] = [];
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const content = await page.getTextContent();
      const raw = content.items.map((item) => ('str' in item ? item.str : '')).join('');
      texts.push(normalizeSearchable(raw));
    }
    pageTextsRef.current = texts;
    return texts;
  }, []);

  const goToMatch = useCallback(
    (globalIndex: number) => {
      if (!matchCounts) return;
      setActiveMatch(globalIndex);
      const pos = resolveMatchPosition(matchCounts, globalIndex);
      if (pos && !spreads[spreadIndexOfPage(pos.page)]?.includes(currentPage)) {
        goToPage(pos.page);
      } else if (pos) {
        setCurrentPage(pos.page);
      }
    },
    [matchCounts, spreads, spreadIndexOfPage, currentPage, goToPage],
  );

  const commitSearch = useCallback(async () => {
    if (!doc) return;
    const query = searchInput.trim();
    const folded = normalizeSearchable(query);
    if (!folded) {
      setSearch(null);
      setMatchCounts(null);
      setActiveMatch(-1);
      return;
    }
    // Repetir Enter na mesma consulta avança para a próxima ocorrência.
    if (search && search.folded === folded && totalMatches > 0) {
      goToMatch((activeMatch + 1) % totalMatches);
      return;
    }
    setSearching(true);
    try {
      const texts = await ensurePageTexts(doc);
      const counts = texts.map((text) => findMatchStarts(text, folded).length);
      const total = counts.reduce((sum, c) => sum + c, 0);
      setSearch({ query, folded });
      setMatchCounts(counts);
      if (total > 0) {
        const first = resolveMatchPosition(counts, 0);
        setActiveMatch(0);
        if (first) goToPage(first.page);
      } else {
        setActiveMatch(-1);
      }
    } finally {
      setSearching(false);
    }
  }, [doc, searchInput, search, totalMatches, activeMatch, goToMatch, ensurePageTexts, goToPage]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearch(null);
    setMatchCounts(null);
    setActiveMatch(-1);
  }, []);

  /* ----- aplica destaques nas camadas de texto renderizadas ----- */
  useEffect(() => {
    const folded = search?.folded ?? '';
    for (const [pageNumber, container] of textLayersRef.current) {
      markGroupsRef.current.set(pageNumber, applyHighlights(container, folded));
    }
    if (!search || activeMatch < 0 || !matchCounts) return;
    const pos = resolveMatchPosition(matchCounts, activeMatch);
    if (!pos) return;
    const group = markGroupsRef.current.get(pos.page)?.[pos.localIndex];
    if (!group || group.length === 0) return;
    for (const mark of group) mark.classList.add('pdfv-mark--active');
    // Centraliza a ocorrência apenas dentro do contêiner de rolagem do viewer.
    const scroll = scrollRef.current;
    if (scroll) {
      const markBox = group[0].getBoundingClientRect();
      const scrollBox = scroll.getBoundingClientRect();
      scroll.scrollTop += markBox.top + markBox.height / 2 - (scrollBox.top + scrollBox.height / 2);
      scroll.scrollLeft += markBox.left + markBox.width / 2 - (scrollBox.left + scrollBox.width / 2);
    }
  }, [search, activeMatch, matchCounts, layerVersion, scrollMode, layout, scale, rotation]);

  /* ----- teclado ----- */
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
          event.preventDefault();
          goToSpread(1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          goToSpread(-1);
          break;
        case 'Home':
          event.preventDefault();
          goToPage(1);
          break;
        case 'End':
          event.preventDefault();
          goToPage(numPages);
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        default:
          break;
      }
    },
    [goToSpread, goToPage, numPages, zoomIn, zoomOut],
  );

  /* ----- rolagem da miniatura ativa ----- */
  useEffect(() => {
    if (!sidebarOpen) return;
    const container = thumbsRef.current;
    const active = container?.querySelector<HTMLElement>(`[data-thumb="${currentPage}"]`);
    if (!container || !active) return;
    const top = active.offsetTop;
    const bottom = top + active.offsetHeight;
    if (top < container.scrollTop) container.scrollTop = Math.max(0, top - 8);
    else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight + 8;
  }, [currentPage, sidebarOpen]);

  const zoomLabel =
    zoom === 'fit-width' ? 'Largura' : zoom === 'fit-page' ? 'Página' : `${Math.round(scale * 100)}%`;

  const visibleSpreads = scrollMode === 'paged' ? [spreads[currentSpreadIdx] ?? []] : spreads;

  /* ------------------------------------------------------------------ */

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-col overflow-hidden rounded-md border bg-background outline-none',
        isFullscreen && 'h-screen w-screen rounded-none border-0',
        className,
      )}
    >
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5">
        <ToolButton title={sidebarOpen ? 'Ocultar miniaturas' : 'Mostrar miniaturas'} active={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)} disabled={!doc}>
          <PanelLeft className="h-4 w-4" />
        </ToolButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Navegação de páginas */}
        <ToolButton title="Página anterior" onClick={() => goToSpread(-1)} disabled={!doc || currentSpreadIdx === 0}>
          <ChevronLeft className="h-4 w-4" />
        </ToolButton>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const parsed = parseInt(pageInput, 10);
                if (Number.isFinite(parsed)) goToPage(parsed);
              }
            }}
            onBlur={() => setPageInput(String(currentPage))}
            disabled={!doc}
            aria-label="Página atual"
            className="h-7 w-11 rounded-md border bg-background text-center text-xs text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
          />
          <span className="whitespace-nowrap">/ {numPages || '-'}</span>
        </div>
        <ToolButton title="Próxima página" onClick={() => goToSpread(1)} disabled={!doc || currentSpreadIdx >= spreads.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </ToolButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Zoom */}
        <ToolButton title="Reduzir zoom" onClick={zoomOut} disabled={!doc}>
          <ZoomOutIcon />
        </ToolButton>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild disabled={!doc}>
            <button
              type="button"
              className="inline-flex h-8 min-w-[76px] items-center justify-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              title="Nível de zoom"
            >
              {zoomLabel}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenu.Trigger>
          {/* Em tela cheia o portal precisa ficar dentro do elemento fullscreen. */}
          <DropdownMenu.Portal container={isFullscreen ? rootRef.current : undefined}>
            <DropdownMenu.Content className={menuContentClass} sideOffset={6} align="start">
              <MenuItem onSelect={() => setZoom('fit-width')} selected={zoom === 'fit-width'} icon={<StretchIcon />}>Ajustar à largura</MenuItem>
              <MenuItem onSelect={() => setZoom('fit-page')} selected={zoom === 'fit-page'} icon={<File className="h-3.5 w-3.5" />}>Ajustar à página</MenuItem>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              {ZOOM_PRESETS.map((preset) => (
                <MenuItem key={preset} onSelect={() => setZoom(preset)} selected={zoom === preset} icon={<span className="w-3.5" />}>
                  {Math.round(preset * 100)}%
                </MenuItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <ToolButton title="Aumentar zoom" onClick={zoomIn} disabled={!doc}>
          <ZoomInIcon />
        </ToolButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Opções de visualização (transição, rotação, layout) */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild disabled={!doc}>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              title="Opções de visualização"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Visualização</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal container={isFullscreen ? rootRef.current : undefined}>
            <DropdownMenu.Content className={menuContentClass} sideOffset={6} align="start">
              <MenuLabel>Transição de página</MenuLabel>
              <MenuItem onSelect={() => setScrollMode('continuous')} selected={scrollMode === 'continuous'} icon={<GalleryVertical className="h-3.5 w-3.5" />}>Contínuo</MenuItem>
              <MenuItem onSelect={() => { setScrollMode('paged'); goToPage(currentPage); }} selected={scrollMode === 'paged'} icon={<StickyNote className="h-3.5 w-3.5" />}>Página por página</MenuItem>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <MenuLabel>Girar</MenuLabel>
              <MenuItem onSelect={() => rotate(90)} icon={<RotateCw className="h-3.5 w-3.5" />}>Sentido horário</MenuItem>
              <MenuItem onSelect={() => rotate(-90)} icon={<RotateCcw className="h-3.5 w-3.5" />}>Sentido anti-horário</MenuItem>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <MenuLabel>Layout</MenuLabel>
              <MenuItem onSelect={() => setLayout('single')} selected={layout === 'single'} icon={<File className="h-3.5 w-3.5" />}>Página única</MenuItem>
              <MenuItem onSelect={() => setLayout('double')} selected={layout === 'double'} icon={<Columns2 className="h-3.5 w-3.5" />}>Página dupla</MenuItem>
              <MenuItem onSelect={() => setLayout('cover')} selected={layout === 'cover'} icon={<BookOpen className="h-3.5 w-3.5" />}>Capa</MenuItem>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <MenuItem closeOnSelect onSelect={toggleFullscreen} icon={isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}>
                {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              </MenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Ferramentas */}
        <ToolButton title="Ferramenta de seleção de texto" active={tool === 'select'} onClick={() => setTool('select')} disabled={!doc}>
          <TextCursor className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Ferramenta mão (arrastar para rolar)" active={tool === 'pan'} onClick={() => setTool('pan')} disabled={!doc}>
          <Hand className="h-4 w-4" />
        </ToolButton>

        <div className="ml-auto flex items-center gap-1">
          {/* Busca */}
          <div className="flex h-8 items-center gap-1 rounded-md border bg-background px-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void commitSearch();
                } else if (e.key === 'Escape') {
                  clearSearch();
                }
              }}
              placeholder="Procurar no documento"
              disabled={!doc}
              className="h-full w-32 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-40 sm:w-44"
            />
            {search && (
              <span className={cn('whitespace-nowrap text-[10px] tabular-nums', totalMatches === 0 ? 'text-red-500' : 'text-muted-foreground')}>
                {searching ? '...' : totalMatches === 0 ? '0 de 0' : `${activeMatch + 1} de ${totalMatches}`}
              </span>
            )}
            <button
              type="button"
              title="Ocorrência anterior"
              disabled={totalMatches === 0}
              onClick={() => goToMatch((activeMatch - 1 + totalMatches) % totalMatches)}
              className="text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Próxima ocorrência"
              disabled={totalMatches === 0}
              onClick={() => goToMatch((activeMatch + 1) % totalMatches)}
              className="text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {(search || searchInput) && (
              <button type="button" title="Limpar busca" onClick={clearSearch} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {onDownload && (
            <ToolButton title={fileName ? `Baixar ${fileName}` : 'Baixar PDF'} onClick={onDownload}>
              <Download className="h-4 w-4" />
            </ToolButton>
          )}
          <ToolButton title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} onClick={toggleFullscreen} disabled={!doc}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </ToolButton>
        </div>
      </div>

      {/* Área principal */}
      <div className="flex min-h-0 flex-1">
        {/* Miniaturas */}
        {sidebarOpen && doc && (
          <div ref={thumbsRef} className="relative w-[132px] shrink-0 space-y-1 overflow-y-auto border-r bg-muted/20 p-2">
            {pageDims.map((dims, idx) => (
              <PdfThumbnail
                key={idx + 1}
                doc={doc}
                pageNumber={idx + 1}
                dims={dims}
                rotation={rotation}
                active={currentPage === idx + 1}
                scrollRoot={thumbsEl}
                onSelect={(page) => goToPage(page)}
              />
            ))}
          </div>
        )}

        {/* Superfície de rolagem */}
        <div
          ref={scrollRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            'relative flex-1 overflow-auto bg-slate-200/80 dark:bg-slate-950',
            tool === 'pan' && 'pdfv-pan-tool cursor-grab',
            panning && 'pdfv-panning cursor-grabbing',
          )}
        >
          {loadError && (
            <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">{loadError}</div>
          )}
          {!loadError && !doc && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
              <span>Carregando documento... {progress > 0 ? `${progress}%` : ''}</span>
            </div>
          )}
          {doc && (
            <div className={cn('flex min-h-full flex-col items-center gap-4 p-6', scrollMode === 'paged' && 'justify-center')}>
              {visibleSpreads.map((group, idx) => {
                const spreadIdx = scrollMode === 'paged' ? currentSpreadIdx : idx;
                return (
                  <div
                    key={spreadIdx}
                    ref={(el) => {
                      spreadElsRef.current[spreadIdx] = el;
                    }}
                    className="flex items-start justify-center"
                    style={{ gap: PAGE_GAP }}
                  >
                    {group.map((pageNumber) => {
                      const size = pageCssSize(pageNumber);
                      return (
                        <PdfPageView
                          key={pageNumber}
                          doc={doc}
                          pageNumber={pageNumber}
                          cssWidth={size.width}
                          cssHeight={size.height}
                          scale={scale}
                          rotation={rotation}
                          scrollRoot={scrollEl}
                          eager={scrollMode === 'paged'}
                          onTextLayer={handleTextLayer}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Ícones de zoom com traço consistente (evita depender de nomes instáveis). */
function ZoomInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
    </svg>
  );
}

function StretchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M3 12h18" />
      <path d="m7 8-4 4 4 4" />
      <path d="m17 8 4 4-4 4" />
    </svg>
  );
}

export default PdfViewer;
