import { createTranslator } from '@netboxplus/i18n';
import { Logo } from '@netboxplus/ui';

const t = createTranslator('tr');

export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-4 text-center font-sans text-ink">
      <Logo className="text-3xl" />
      <h1 className="font-display text-2xl font-bold text-ink-strong">{t('admin.title')}</h1>
      <p className="text-ink-muted">{t('admin.comingSoon')}</p>
    </main>
  );
}
