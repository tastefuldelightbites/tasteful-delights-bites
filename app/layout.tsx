import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Figtree } from 'next/font/google';
import { CartProvider } from '@/components/CartProvider';
import { VisitorPing } from '@/components/VisitorPing';
import { Reveal } from '@/components/Reveal';
import './globals.css';

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const sans = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Tasteful Delights Bites · Order Cookies & Honey Bun Cakes',
  description: 'Small-batch cookies and honey bun cakes from Mauldin, SC. Preorder for pickup or local delivery.',
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
