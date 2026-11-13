'use client';

/** Last-resort page if the whole site fails to load (customers never see "Application error"). */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  console.error('Site error', error?.digest ?? '', error);
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#FAF5EC', color: '#2A2A2A', fontFamily: 'system-ui, sans-serif' }}>
        <meta httpEquiv="refresh" content="5" />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '110px 22px', textAlign: 'center' }}>
          <p style={{ letterSpacing: '.12em', fontWeight: 700, fontSize: 14 }}>ONE MOMENT</p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 40, margin: '18px 0' }}>Tasteful Delights Bites</h1>
          <p style={{ fontSize: 19, lineHeight: 1.6 }}>Our menu is loading. This page will try again by itself in a few seconds.</p>
          <p style={{ marginTop: 30 }}>
            <a href="/" style={{ display: 'inline-block', background: '#2A2A2A', color: '#FAF5EC', padding: '18px 30px', borderRadius: 999, fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>Try Again</a>
          </p>
        </div>
      </body>
    </html>
  );
}
