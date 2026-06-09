import { NextResponse } from 'next/server';

export function GET() {
  const key = process.env.INDEXNOW_KEY ?? 'configure-indexnow-key';
  return new NextResponse(key, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
