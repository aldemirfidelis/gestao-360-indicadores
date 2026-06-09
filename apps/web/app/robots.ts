import type { MetadataRoute } from 'next';
import { SITE_URL, privateRoutePrefixes } from '@/lib/public-site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...privateRoutePrefixes, '/staging', '/homologacao', '/dev', '/_next/static/chunks/', '/*?token=', '/*?session='],
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: [...privateRoutePrefixes, '/staging', '/homologacao', '/dev'],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
