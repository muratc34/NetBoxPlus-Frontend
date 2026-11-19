'use client';

import { createAppQueryClient, createBrowserGateway, GatewayProvider, queryKeys } from '@netboxplus/core';
import type { Locale } from '@netboxplus/i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { LocaleProvider } from '../../i18n/translator';
import { signInPath } from '../../routes';

// Inlined at build time; the browser calls the gateway on its public address.
const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:5100';

/**
 * The client-side state of every page: the page's language, the gateway and the query cache. When a
 * request finds the session gone, everything personal is forgotten and the visitor signs in again,
 * coming back to the page they were on.
 */
export function Providers({ locale, children }: Readonly<{ locale: Locale; children: ReactNode }>) {
  const router = useRouter();
  const [gateway] = useState(() => createBrowserGateway(gatewayUrl));
  // The cache only counts endings; the effect below, which knows the router, acts on them.
  const [endings, setEndings] = useState(0);
  const [queryClient] = useState(() =>
    createAppQueryClient({
      onSessionEnded: () => {
        setEndings((count) => count + 1);
      },
    }),
  );

  useEffect(() => {
    if (endings === 0) {
      return;
    }
    queryClient.clear();
    queryClient.setQueryData(queryKeys.session, null);
    router.replace(signInPath(locale, window.location.pathname + window.location.search));
  }, [endings, queryClient, router, locale]);

  return (
    <LocaleProvider locale={locale}>
      <QueryClientProvider client={queryClient}>
        <GatewayProvider gateway={gateway}>{children}</GatewayProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}
