import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Montserrat, Playfair_Display } from 'next/font/google';
import { CartProvider } from '@/components/CartProvider';
import { VisitorPing } from '@/components/VisitorPing';
import { Reveal } from '@/components/Reveal';
import './globals.css';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700'], style: ['italic'], variable: '--font-playfair', display: 'swap' });
const display = Archivo_Black({ subsets: ['latin'], weight: ['400'], variable: '--font-display', display: 'swap' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-montserrat', display: 'swap' });

export const metadata: Metadata = {
  title: 'Tasteful Delights Bites · Preorder',
  description: 'Small-batch cookies and honey bun cakes from Mauldin, SC. Preorder for Saturday pickup or local delivery.',
};

export const viewport: Viewport = { themeColor: '#F5F0E8', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${playfair.variable} ${montserrat.variable}`}>
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
