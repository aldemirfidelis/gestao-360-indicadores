'use client';

import { useEffect, useRef, useState } from 'react';

interface UseInViewOptions extends IntersectionObserverInit {
  /** Se true (padrão), permanece "em view" após a primeira aparição (não desmonta). */
  once?: boolean;
}

/**
 * Observa quando um elemento entra na viewport. Usado para adiar a montagem de
 * componentes caros (ex.: gráficos recharts) até que estejam visíveis, evitando
 * montar dezenas/centenas de instâncias de uma vez no carregamento da lista.
 *
 * Por padrão usa rootMargin de 200px (renderiza um pouco antes de aparecer) e
 * mantém o elemento montado após a primeira visualização (once).
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(options: UseInViewOptions = {}) {
  const { once = true, rootMargin = '200px', ...rest } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // SSR/ambientes sem suporte: renderiza direto.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      }
    }, { rootMargin, ...rest });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView };
}
