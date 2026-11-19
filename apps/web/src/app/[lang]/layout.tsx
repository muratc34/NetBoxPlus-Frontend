import { createTranslator, isLocale, locales } from '@netboxplus/i18n';
import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { notFound } from 'next/navigation';
import { SiteHeader } from '../../components/site-header';
import { VerificationBanner } from '../../components/verification-banner';
import '../globals.css';
import { Providers } from './providers';

// latin-ext carries the Turkish letters (ç, ğ, ı, ö, ş, ü).
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

const descriptions = {
  tr: 'Filmler ve diziler, Türkçe ve İngilizce, istediğin cihazda.',
  en: 'Movies and series in Turkish and English, on any device.',
} as const;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : 'tr';
  return {
    title: { default: createTranslator(locale)('brand.name'), template: '%s · NetBoxPlus' },
    description: descriptions[locale],
    applicationName: 'NetBoxPlus',
    alternates: { languages: Object.fromEntries(locales.map((other) => [other, `/${other}`])) },
  };
}

export const viewport: Viewport = {
  themeColor: '#121212',
  colorScheme: 'dark',
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  return (
    <html lang={lang} className={`${inter.variable} ${montserrat.variable}`}>
      <body className="flex min-h-dvh flex-col bg-canvas font-sans text-ink antialiased">
        <Providers locale={lang}>
          <SiteHeader />
          <VerificationBanner />
          <div className="flex flex-1 flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
