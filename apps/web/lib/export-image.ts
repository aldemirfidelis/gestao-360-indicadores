import { toPng } from 'html-to-image';

/**
 * Exporta um nó do DOM como PNG e dispara o download. Centraliza o padrão antes
 * duplicado em várias telas (ferramentas de análise, fluxogramas, estrutura do banco).
 *
 * Retorna `true` em caso de sucesso e `false` se o nó for nulo ou a renderização falhar.
 */
export async function exportNodeToPng(
  node: HTMLElement | null | undefined,
  filename: string,
  options?: { backgroundColor?: string; pixelRatio?: number; cacheBust?: boolean },
): Promise<boolean> {
  if (!node) return false;
  try {
    const dataUrl = await toPng(node, {
      backgroundColor: options?.backgroundColor ?? '#f8fafc',
      pixelRatio: options?.pixelRatio ?? 2,
      cacheBust: options?.cacheBust ?? false,
    });
    const link = document.createElement('a');
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = dataUrl;
    link.click();
    return true;
  } catch {
    // Navegadores antigos podem falhar no html-to-image — não quebra a tela.
    return false;
  }
}
