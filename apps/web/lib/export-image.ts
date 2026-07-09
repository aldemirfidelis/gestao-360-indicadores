import { toPng } from 'html-to-image';

/**
 * Exporta um nó do DOM como PNG e dispara o download. Centraliza o padrão antes
 * duplicado em várias telas (ferramentas de análise, fluxogramas, estrutura do banco).
 *
 * As imagens vão para apresentações (PowerPoint), então a captura precisa sair
 * completa e legível:
 *  - neutraliza `transform` (zoom das ferramentas) no nó raiz — com scale ≠ 1 o
 *    html-to-image renderiza escalado mas mede o layout sem escala, cortando ou
 *    deslocando o conteúdo;
 *  - mede por scrollWidth/scrollHeight (pega conteúdo que transborda o clientBox);
 *  - expande temporariamente descendentes roláveis (overflow auto/scroll com
 *    conteúdo cortado) para o texto completo aparecer — exceto posicionados
 *    absolutos (expandir sobreporia vizinhos, ex.: cards do Ishikawa).
 *
 * Retorna `true` em caso de sucesso e `false` se o nó for nulo ou a renderização falhar.
 */
export async function exportNodeToPng(
  node: HTMLElement | null | undefined,
  filename: string,
  options?: {
    backgroundColor?: string;
    pixelRatio?: number;
    cacheBust?: boolean;
    /** desliga a expansão de descendentes roláveis se alguma tela específica quebrar */
    expandScrollables?: boolean;
  },
): Promise<boolean> {
  if (!node) return false;

  // Mutações temporárias no DOM real (restauradas no finally) — técnica padrão
  // para capturas fiéis; a tela pisca imperceptivelmente durante o toPng.
  const restores: Array<() => void> = [];
  const remember = (el: HTMLElement, prop: string) => {
    const prev = el.style.getPropertyValue(prop);
    const prevPriority = el.style.getPropertyPriority(prop);
    restores.push(() => {
      if (prev) el.style.setProperty(prop, prev, prevPriority);
      else el.style.removeProperty(prop);
    });
  };

  try {
    // 1. Zoom/transform do nó raiz fora da captura.
    const computedRoot = window.getComputedStyle(node);
    if (computedRoot.transform && computedRoot.transform !== 'none') {
      remember(node, 'transform');
      node.style.setProperty('transform', 'none');
    }

    // 2. Expande descendentes roláveis com conteúdo cortado (texto truncado na imagem).
    if (options?.expandScrollables !== false) {
      const all = node.querySelectorAll<HTMLElement>('*');
      all.forEach((el) => {
        const cs = window.getComputedStyle(el);
        const scrollableY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
        const scrollableX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
        if (!scrollableY && !scrollableX) return;
        // Absolutos expandidos sobrepõem os vizinhos (cards do Ishikawa) — não mexe.
        if (cs.position === 'absolute' || cs.position === 'fixed') return;
        if (scrollableY) {
          remember(el, 'max-height');
          remember(el, 'height');
          remember(el, 'overflow-y');
          el.style.setProperty('max-height', 'none');
          el.style.setProperty('height', 'auto');
          el.style.setProperty('overflow-y', 'visible');
        }
        if (scrollableX) {
          remember(el, 'max-width');
          remember(el, 'overflow-x');
          el.style.setProperty('max-width', 'none');
          el.style.setProperty('overflow-x', 'visible');
        }
      });
    }

    // 3. Mede DEPOIS das mutações: dimensões do conteúdo completo, sem escala.
    const width = Math.ceil(Math.max(node.scrollWidth, node.clientWidth));
    const height = Math.ceil(Math.max(node.scrollHeight, node.clientHeight));

    const dataUrl = await toPng(node, {
      backgroundColor: options?.backgroundColor ?? '#f8fafc',
      pixelRatio: options?.pixelRatio ?? 2,
      cacheBust: options?.cacheBust ?? false,
      width,
      height,
      style: {
        // O clone interno também não pode herdar o transform/limites do original.
        transform: 'none',
        maxHeight: 'none',
        maxWidth: 'none',
      },
    });
    const link = document.createElement('a');
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = dataUrl;
    link.click();
    return true;
  } catch {
    // Navegadores antigos podem falhar no html-to-image — não quebra a tela.
    return false;
  } finally {
    restores.forEach((restore) => restore());
  }
}
