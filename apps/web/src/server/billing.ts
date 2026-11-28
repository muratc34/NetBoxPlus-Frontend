import { readPlans, type PlanOffer } from '@netboxplus/core/reads';
import type { Locale } from '@netboxplus/i18n';
import { boundedCache } from './bounded-cache';
import { gatewayForVisitor } from './gateway';

/** Plans change about as rarely as the catalog: their read is shared between visitors for a minute. */
export const plansRevalidateSeconds = 60;

/** The oldest a plans read is shown, in seconds (see `boundedCache`). */
export const plansMaxAgeSeconds = 300;

/** The plans on sale in `lang`, cheapest first. */
export async function loadPlans(lang: Locale): Promise<PlanOffer[]> {
  const gateway = await gatewayForVisitor();
  return boundedCache(() => readPlans(gateway.billing, lang), ['billing', 'plans', lang], {
    revalidate: plansRevalidateSeconds,
    maxAge: plansMaxAgeSeconds,
  });
}
