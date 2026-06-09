import type { MetadataRoute } from 'next';
import { SITE_URL, publicRoutes } from '@/lib/public-site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return publicRoutes.map((route) => ({
    url: `${SITE_URL}${route === '/' ? '' : route}`,
    lastModified: now,
    changeFrequency: route.startsWith('/conteudos/artigos') ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route.split('/').length <= 2 ? 0.8 : 0.65,
  }));
}
