import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Figtree } from 'next/font/google';
import { CartProvider } from '@/components/CartProvider';
import { VisitorPing } from '@/components/VisitorPing';
import { Reveal } from '@/components/Reveal';
import './globals.css';

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const sans = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-sans', display: 'swap' });

const TITLE = 'Tasteful Delights Bites · Order Cookies & Honey Bun Cakes';
const DESCRIPTION = 'Small-batch cookies and honey bun cakes from Mauldin, SC. Preorder for pickup or local delivery.';
/** Link preview picture (texts, Facebook, Instagram): the logo on the site's cream background, 1200 × 630. */
const PREVIEW = { url: '/og-image.png', width: 1200, height: 630, alt: 'Tasteful Delights Bites logo' };

export const metadata: Metadata = {
  metadataBase: new URL('https://tastefuldelightsbites.com'),
  title: TITLE,
  description: DESCRIPTION,
  // Every page uses the logo picture for link previews (pages don't set their own).
  openGraph: { type: 'website', siteName: 'Tasteful Delights Bites', title: TITLE, description: DESCRIPTION, url: '/', images: [PREVIEW] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [PREVIEW] },
};

export const viewport: Viewport = { themeColor: '#FAF5EC', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <CartProvider>
          {children}
          <VisitorPing />
          <Reveal />
        </CartProvider>
      </body>
    </html>
  );
}
