/**
 * The billing reads without React: the plans page asks for the plans on sale while it renders on the web
 * server. Nothing here may import React.
 */
import { unwrap, type BillingSchemas, type PublicClients } from '@netboxplus/api';
import type { Locale } from '@netboxplus/i18n';

export type PlanOffer = BillingSchemas['PlanOffer'];
export type VideoQuality = BillingSchemas['VideoQuality'];

/** The plans on sale, cheapest first, described in `lang` (Turkish when a plan has no text in it). */
export function readPlans(billing: PublicClients['billing'], lang: Locale): Promise<PlanOffer[]> {
  return unwrap(billing.GET('/plans', { params: { query: { lang } } }));
}

/**
 * A price as the visitor reads it: `amountMinor` is in the currency's smallest unit (kuruş, cent), so it
 * is divided by as many tens as the currency has decimals.
 */
export function formatPrice(amountMinor: number, currency: string, locale: Locale): string {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const decimals = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amountMinor / 10 ** decimals);
}
