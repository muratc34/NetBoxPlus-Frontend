import { createTranslator, isLocale } from '@netboxplus/i18n';
import { Logo } from '@netboxplus/ui';
import { notFound } from 'next/navigation';

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  const t = createTranslator(lang);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo className="text-4xl" />
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('web.comingSoon.title')}</h1>
      <p className="max-w-md text-ink-muted">{t('web.comingSoon.body')}</p>
    </main>
  );
}
