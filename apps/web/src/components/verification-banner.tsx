'use client';

import { problemMessageKey, useEmailVerification, useResendVerification, useSession } from '@netboxplus/core';
import { Button } from '@netboxplus/ui';
import { useLocale } from '../i18n/translator';

/**
 * Reminds a signed-in account to confirm its address: browsing works without it, a subscription does
 * not. The backend sends at most one link a minute and says so when asked again too soon.
 */
export function VerificationBanner() {
  const { t } = useLocale();
  const session = useSession();
  const verification = useEmailVerification(Boolean(session.data));
  const resend = useResendVerification();

  if (!session.data || verification.data?.verified !== false) {
    return null;
  }

  return (
    <aside
      className="relative z-20 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-surface-raised px-4 py-3 text-center text-sm"
      aria-live="polite"
    >
      <p>{t('auth.banner.unverified')}</p>
      {resend.isSuccess ? (
        <p className="font-semibold text-brand">{t('auth.banner.sent')}</p>
      ) : (
        <Button
          variant="secondary"
          className="h-9 px-3 text-sm"
          disabled={resend.isPending}
          onClick={() => {
            resend.mutate();
          }}
        >
          {t('auth.banner.resend')}
        </Button>
      )}
      {resend.isError && (
        <p role="alert" className="w-full text-ink-muted">
          {t(problemMessageKey(resend.error))}
        </p>
      )}
    </aside>
  );
}
