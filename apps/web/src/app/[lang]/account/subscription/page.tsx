import { isLocale } from '@netboxplus/i18n';
import { notFound, redirect } from 'next/navigation';
import { routes } from '../../../../routes';

/**
 * Where Billing sends the browser back from the payment provider (its return addresses are configured
 * there, not here): the account page, keeping the query (`?checkout=success`).
 */
export default async function SubscriptionReturnRoute({
  params,
  searchParams,
}: PageProps<'/[lang]/account/subscription'>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of [value ?? []].flat()) {
      query.append(key, item);
    }
  }
  const search = query.toString();
  redirect(search ? `${routes.account(lang)}?${search}` : routes.account(lang));
}
