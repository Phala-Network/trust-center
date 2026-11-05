import {NextResponse} from 'next/server'

// Maintenance mode: every request (pages, /api/*, Server Actions, sitemap,
// OG images, static chunks) gets this 503 page. Restore by reverting this
// commit, which also brings back the /app/:id/embed referer guard.
const MAINTENANCE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Phala Trust Center - 建设中</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #111; }
  @media (prefers-color-scheme: dark) { body { background: #0a0a0a; color: #eee; } }
  main { text-align: center; padding: 24px 16px; max-width: 480px; }
  h1 { font-size: 24px; font-weight: 600; margin: 0 0 12px; }
  p { margin: 4px 0; opacity: .7; line-height: 1.5; }
</style>
</head>
<body>
<main>
  <h1>建设中 · Under construction</h1>
  <p>Phala Trust Center 正在维护，暂时无法访问。</p>
  <p>Phala Trust Center is temporarily unavailable for maintenance.</p>
</main>
</body>
</html>`

export function middleware() {
  return new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '3600',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

export const config = {
  matcher: '/:path*',
}
