import { Inter, Montserrat } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// latin-ext carries the Turkish letters (ç, ğ, ı, ö, ş, ü).
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'NetBoxPlus', template: '%s · NetBoxPlus' },
  description: 'Filmler ve diziler, Türkçe ve İngilizce, istediğin cihazda.',
  applicationName: 'NetBoxPlus',
};

export const viewport: Viewport = {
  themeColor: '#121212',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="tr" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
