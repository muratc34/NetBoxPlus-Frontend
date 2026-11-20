'use client';

import { Button } from '@netboxplus/ui';
import { useLocale } from '../../i18n/translator';

/** When a page cannot be rendered, such as the gateway not answering: the header stays, and a retry. */
export default function PageError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const { t } = useLocale();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold text-ink-strong">{t('page.error.title')}</h1>
      <p className="max-w-md text-ink-muted">{t('page.error.body')}</p>
      <Button onClick={reset}>{t('page.error.retry')}</Button>
    </main>
  );
}
