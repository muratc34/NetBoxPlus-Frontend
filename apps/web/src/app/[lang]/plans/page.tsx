import { createTranslator, isLocale, locales } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlansPage } from '../../../features/plans/plans-page';
import { routes } from '../../../routes';
import { loadPlans } from '../../../server/billing';

export async function generateMetadata({ params }: PageProps<'/[lang]/plans'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) {
    return {};
  }
  const t = createTranslator(lang);
  return {
    title: t('plans.title'),
    description: t('plans.description'),
    alternates: {
      canonical: routes.plans(lang),
      languages: Object.fromEntries(locales.map((other) => [other, routes.plans(other)])),
    },
  };
}

/** The plans on sale, rendered on the server; what each plan's button does is decided in the browser. */
export default async function PlansRoute({ params }: PageProps<'/[lang]/plans'>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  return <PlansPage plans={await loadPlans(lang)} />;
}
