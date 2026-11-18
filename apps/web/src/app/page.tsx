import { createTranslator } from '@netboxplus/i18n';
import { Logo } from '@netboxplus/ui';

const t = createTranslator('tr');

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo className="text-4xl" />
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('web.comingSoon.title')}</h1>
      <p className="max-w-md text-ink-muted">{t('web.comingSoon.body')}</p>
    </main>
  );
}
