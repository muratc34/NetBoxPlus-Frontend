import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError } from '@netboxplus/api';
import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, SelectField, TextAreaField, TextField } from '@netboxplus/ui';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { ConfirmDialog } from '../components/confirm-dialog';
import { messageOf, showProblem } from '../components/form-errors';
import { UnsavedChanges } from '../components/unsaved-changes';
import { ConflictNotice } from '../catalog/title-sections';
import {
  planCurrency,
  qualities,
  usePlan,
  useSavePlan,
  useSetPlanOnSale,
  type PlanDetails,
  type PlanRequest,
} from '../data/billing';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { SaleBadge } from './sale-badge';

/** Billing's limits on a plan. */
export const planLimits = { name: 64, description: 500, priceId: 128, screens: 10 } as const;

const optionalText = (max: number, message: string) => z.string().trim().max(max, message);

const schema = z
  .object({
    nameTr: z.string().trim().min(1, 'validation.required').max(planLimits.name, 'error.Plan.NameTooLong'),
    descriptionTr: optionalText(planLimits.description, 'error.Plan.DescriptionTooLong'),
    nameEn: optionalText(planLimits.name, 'error.Plan.NameTooLong'),
    descriptionEn: optionalText(planLimits.description, 'error.Plan.DescriptionTooLong'),
    price: z
      .string()
      .trim()
      .regex(/^\d{1,9}([.,]\d{1,2})?$/, 'admin.plans.priceFormat')
      .refine((value) => amountOf(value) > 0, 'error.Plan.AmountInvalid'),
    quality: z.enum(['Sd', 'Hd', 'Uhd']),
    maxScreens: z
      .string()
      .trim()
      .regex(/^\d+$/, 'error.Plan.ScreensInvalid')
      .refine(
        (value) => Number(value) >= 1 && Number(value) <= planLimits.screens,
        'error.Plan.ScreensInvalid',
      ),
    providerPriceId: z
      .string()
      .trim()
      .min(1, 'validation.required')
      .max(planLimits.priceId, 'error.Plan.ProviderPriceRequired'),
  })
  // An English description needs an English name, as Billing asks of every language it keeps.
  .refine((values) => values.descriptionEn === '' || values.nameEn !== '', {
    path: ['nameEn'],
    message: 'error.Plan.NameRequired',
  });
type Values = z.infer<typeof schema>;

/** A price as typed ("199,99", "199.99", "200") in the smallest unit: kuruş. */
export function amountOf(price: string): number {
  const [whole = '0', fraction = ''] = price.trim().split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Kuruş as the field shows them, with the locale's decimal mark ("199,99"). */
export function priceOf(amountMinor: number, locale: string): string {
  const text = (amountMinor / 100).toFixed(2);
  return locale === 'tr' ? text.replace('.', ',') : text;
}

const valuesOf = (plan: PlanDetails | undefined, locale: string): Values => {
  const text = (language: string) =>
    (plan?.translations[language] ?? {}) as { name?: string | null; description?: string | null };
  return {
    nameTr: text('tr').name ?? '',
    descriptionTr: text('tr').description ?? '',
    nameEn: text('en').name ?? '',
    descriptionEn: text('en').description ?? '',
    price: plan ? priceOf(plan.amountMinor, locale) : '',
    quality: plan?.quality ?? 'Hd',
    maxScreens: plan ? String(plan.maxScreens) : '1',
    providerPriceId: plan?.providerPriceId ?? '',
  };
};

const requestOf = (values: Values, version: number): PlanRequest => ({
  translations: {
    tr: { name: values.nameTr, description: values.descriptionTr || null },
    ...(values.nameEn ? { en: { name: values.nameEn, description: values.descriptionEn || null } } : {}),
  },
  amountMinor: amountOf(values.price),
  currency: planCurrency,
  quality: values.quality,
  maxScreens: Number(values.maxScreens),
  providerPriceId: values.providerPriceId,
  version,
});

const isConflict = (error: unknown) => isApiError(error) && error.code === 'Plan.VersionConflict';

/**
 * A plan: its names and descriptions in Turkish and English, price, quality, screens and Stripe price, and
 * whether it is on sale. `/plans/new` makes one (off sale) and goes on to its page. Without the write
 * permission it is read only.
 */
export function PlanPage() {
  const { t } = useLocale();
  const id = useParams().id;
  const plan = usePlan(id);
  // Loading the current version after a conflict starts the editor again from it.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    document.title = plan.data?.name ?? t('admin.plans.new');
  }, [plan.data?.name, t]);

  if (id !== undefined && plan.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (plan.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(plan.error))}
      </p>
    );
  }
  return (
    <PlanEditor
      key={`${plan.data?.id ?? 'new'}:${String(generation)}`}
      plan={plan.data}
      onReload={async () => {
        await plan.refetch();
        setGeneration((value) => value + 1);
      }}
    />
  );
}

function PlanEditor({
  plan,
  onReload,
}: Readonly<{ plan: PlanDetails | undefined; onReload: () => Promise<void> }>) {
  const { locale, t } = useLocale();
  const navigate = useNavigate();
  const session = useAdminSession();
  const writable = can(session.data, 'billing:plans:write');
  const save = useSavePlan();
  // The version this editor works from: loaded with the plan, moved on by its own changes.
  const [version, setVersion] = useState(plan?.version ?? 0);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: valuesOf(plan, locale) });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setSaved(false);
    try {
      const id = await save.mutateAsync({
        ...(plan ? { id: plan.id } : {}),
        body: requestOf(values, version),
      });
      form.reset(values);
      if (plan) {
        setVersion((value) => value + 1);
        setSaved(true);
      } else {
        void navigate(paths.plan(id), { replace: true });
      }
    } catch (error) {
      if (isConflict(error)) {
        setConflict(true);
        return;
      }
      showProblem(error, ['quality', 'maxScreens', 'providerPriceId'], form.setError, {
        'Plan.NameRequired': 'nameTr',
        'Plan.NameTooLong': 'nameTr',
        'Plan.DescriptionTooLong': 'descriptionTr',
        'Plan.AmountInvalid': 'price',
        'Plan.QualityInvalid': 'quality',
        'Plan.ScreensInvalid': 'maxScreens',
        'Plan.ProviderPriceRequired': 'providerPriceId',
        'Plan.ProviderPriceTaken': 'providerPriceId',
      });
    }
  });

  return (
    <>
      <UnsavedChanges dirty={isDirty && !isSubmitting} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">
          {plan?.name ?? t('admin.plans.new')}
        </h1>
        {plan && <SaleBadge onSale={plan.isActive} />}
      </div>
      {conflict && <ConflictNotice onReload={onReload} />}
      <form
        noValidate
        aria-label={t('admin.plans.details')}
        onSubmit={(event) => void submit(event)}
        className="flex max-w-3xl flex-col gap-6 rounded-lg bg-surface p-6"
      >
        {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
        {saved && <FormAlert tone="success">{t('admin.saved')}</FormAlert>}
        <fieldset disabled={!writable} className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('admin.plans.nameTr')}
            lang="tr"
            error={messageOf(t, errors.nameTr?.message)}
            {...form.register('nameTr')}
          />
          <TextField
            label={t('admin.plans.nameEn')}
            lang="en"
            error={messageOf(t, errors.nameEn?.message)}
            {...form.register('nameEn')}
          />
          <TextAreaField
            label={t('admin.plans.descriptionTr')}
            lang="tr"
            error={messageOf(t, errors.descriptionTr?.message)}
            {...form.register('descriptionTr')}
          />
          <TextAreaField
            label={t('admin.plans.descriptionEn')}
            lang="en"
            error={messageOf(t, errors.descriptionEn?.message)}
            {...form.register('descriptionEn')}
          />
          <TextField
            label={t('admin.plans.priceLabel').replace('{currency}', planCurrency)}
            inputMode="decimal"
            hint={t('admin.plans.priceHint')}
            error={messageOf(t, errors.price?.message)}
            {...form.register('price')}
          />
          <TextField
            label={t('admin.plans.priceId')}
            hint={t('admin.plans.priceIdHint')}
            error={messageOf(t, errors.providerPriceId?.message)}
            {...form.register('providerPriceId')}
          />
          <SelectField
            label={t('plans.quality')}
            options={qualities.map((quality) => ({ value: quality, label: t(`plans.quality.${quality}`) }))}
            error={messageOf(t, errors.quality?.message)}
            {...form.register('quality')}
          />
          <TextField
            label={t('plans.screens')}
            type="number"
            min={1}
            max={planLimits.screens}
            error={messageOf(t, errors.maxScreens?.message)}
            {...form.register('maxScreens')}
          />
        </fieldset>
        {writable && (
          <button type="submit" className={`${buttonClass('primary')} self-start`} disabled={isSubmitting}>
            {isSubmitting ? t('auth.working') : t('admin.save')}
          </button>
        )}
      </form>
      {plan && writable && (
        <PlanSale
          plan={plan}
          onChanged={() => {
            setVersion((value) => value + 1);
          }}
        />
      )}
    </>
  );
}

/** Putting the plan on sale, or taking it off after asking. */
function PlanSale({ plan, onChanged }: Readonly<{ plan: PlanDetails; onChanged: () => void }>) {
  const { t } = useLocale();
  const id = useId();
  const change = useSetPlanOnSale(plan.id);
  const [asking, setAsking] = useState(false);

  return (
    <section
      aria-labelledby={id}
      className="flex max-w-3xl flex-col items-start gap-3 rounded-lg bg-surface p-6"
    >
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.plans.sale')}
      </h2>
      <p className="text-ink-muted">
        {plan.isActive ? t('admin.plans.onSaleNote') : t('admin.plans.offSaleNote')}
      </p>
      {!asking && change.isError && <FormAlert tone="error">{t(problemMessageKey(change.error))}</FormAlert>}
      {plan.isActive ? (
        <button
          type="button"
          className={buttonClass('danger')}
          onClick={() => {
            change.reset();
            setAsking(true);
          }}
        >
          {t('admin.plans.deactivate')}
        </button>
      ) : (
        <button
          type="button"
          className={buttonClass('primary')}
          disabled={change.isPending}
          onClick={() => {
            change.mutate(true, { onSuccess: onChanged });
          }}
        >
          {change.isPending ? t('auth.working') : t('admin.plans.activate')}
        </button>
      )}
      <ConfirmDialog
        open={asking}
        title={t('admin.plans.deactivateTitle').replace('{name}', plan.name)}
        body={t('admin.plans.deactivateBody')}
        confirmLabel={t('admin.plans.deactivate')}
        busy={change.isPending}
        error={change.isError ? t(problemMessageKey(change.error)) : undefined}
        onConfirm={() => {
          change.mutate(false, {
            onSuccess: () => {
              onChanged();
              setAsking(false);
            },
          });
        }}
        onOpenChange={(open) => {
          setAsking(open);
          if (!open) {
            change.reset();
          }
        }}
      />
    </section>
  );
}
