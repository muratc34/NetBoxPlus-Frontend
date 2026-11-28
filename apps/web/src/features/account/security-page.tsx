'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  PasskeyAlreadyRegistered,
  PasskeyCancelled,
  passkeysSupported,
  problemMessageKey,
  useAddPasskey,
  useDevices,
  useEndDevice,
  useEndOtherDevices,
  useNotificationPreferences,
  usePasskeys,
  useRemovePasskey,
  useRenamePasskey,
  useSession,
  useSetNotificationPreferences,
  type Device,
  type Passkey,
} from '@netboxplus/core';
import type { Locale } from '@netboxplus/i18n';
import { Button } from '@netboxplus/ui';
import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert, TextField } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { routes, signInPath } from '../../routes';
import { messageOf, showProblem } from './form-rules';

/** Auth's limit on a passkey's name. */
const passkeyNameMaxLength = 50;

const section = 'flex flex-col gap-4 rounded-lg bg-surface p-6';
const heading = 'font-display text-xl font-bold text-ink-strong';
const danger =
  'inline-flex h-11 items-center justify-center rounded-md bg-red-700 px-5 text-[15px] font-semibold text-white ' +
  'hover:bg-red-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/**
 * The account's security: the devices it is signed in on (sign one out, or all the others), its passkeys and the
 * e-mail alert for a sign-in from a new device. The sign-in alert e-mail links here. It needs no profile; a visitor
 * without a session signs in first and comes back.
 */
export function SecurityPage() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  useEffect(() => {
    if (session.data === null) {
      router.replace(signInPath(locale, pathname));
    }
  }, [session.data, router, locale, pathname]);

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-16 sm:px-8">
      <div className="flex flex-col gap-2">
        <Link
          href={routes.account(locale)}
          className="self-start text-sm text-ink-muted underline-offset-4 hover:text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
        >
          {t('security.backToAccount')}
        </Link>
        <h1 className="font-display text-3xl font-bold text-ink-strong">{t('security.title')}</h1>
      </div>
      {session.data ? (
        <>
          <Devices />
          <Passkeys />
          <SignInAlerts />
        </>
      ) : (
        <p aria-busy="true" className="py-16 text-center text-ink-muted">
          {t('browse.loading')}
        </p>
      )}
    </main>
  );
}

function Devices() {
  const { locale, t } = useLocale();
  const devices = useDevices(true);
  const end = useEndDevice();
  const endOthers = useEndOtherDevices();
  const others = devices.data?.filter((device) => !device.current) ?? [];

  return (
    <section aria-labelledby="devices-heading" className={section}>
      <h2 id="devices-heading" className={heading}>
        {t('security.devices.title')}
      </h2>
      <p className="text-ink-muted">{t('security.devices.body')}</p>
      {devices.isError && <FormAlert tone="error">{t(problemMessageKey(devices.error))}</FormAlert>}
      {end.isError && <FormAlert tone="error">{t(problemMessageKey(end.error))}</FormAlert>}
      {endOthers.isSuccess && <FormAlert tone="success">{t('security.devices.othersEnded')}</FormAlert>}
      {devices.data ? (
        <ul className="flex flex-col divide-y divide-line">
          {devices.data.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">
                  {deviceName(device, t)}
                  {device.current && <Badge>{t('security.devices.current')}</Badge>}
                  {device.kind === 'Admin' && <Badge>{t('security.devices.admin')}</Badge>}
                </span>
                <span className="text-sm text-ink-muted">
                  {t('security.devices.lastActive').replace(
                    '{date}',
                    formatDateTime(device.lastActiveAt, locale),
                  )}
                </span>
              </div>
              <Button
                variant="secondary"
                className="h-9 px-3 text-sm"
                disabled={end.isPending}
                aria-label={`${t('security.devices.end')}: ${deviceName(device, t)}`}
                onClick={() => {
                  end.mutate(device);
                }}
              >
                {t('security.devices.end')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        !devices.isError && (
          <p role="status" className="text-ink-muted">
            {t('browse.loading')}
          </p>
        )
      )}
      {others.length > 0 && (
        <Confirm
          trigger={t('security.devices.endOthers')}
          title={t('security.devices.endOthersTitle')}
          body={t('security.devices.endOthersBody')}
          confirm={t('security.devices.endOthers')}
          busy={endOthers.isPending}
          onConfirm={() => endOthers.mutateAsync()}
        />
      )}
      {endOthers.isError && <FormAlert tone="error">{t(problemMessageKey(endOthers.error))}</FormAlert>}
    </section>
  );
}

function deviceName(device: Device, t: (key: 'security.devices.unknown') => string): string {
  return device.deviceLabel ?? t('security.devices.unknown');
}

function Badge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-ink">{children}</span>
  );
}

// Whether the browser can make passkeys is only known in the browser: the server renders "unknown", not "no".
const subscribeNever = () => () => undefined;
function usePasskeySupport(): boolean | undefined {
  return useSyncExternalStore(subscribeNever, passkeysSupported, () => undefined);
}

function Passkeys() {
  const { locale, t } = useLocale();
  const passkeys = usePasskeys(true);
  const devices = useDevices(true);
  const supported = usePasskeySupport();
  const remove = useRemovePasskey();
  const [renaming, setRenaming] = useState<Passkey | undefined>(undefined);
  const [added, setAdded] = useState(false);
  const thisDevice = devices.data?.find((device) => device.current)?.deviceLabel ?? '';

  return (
    <section aria-labelledby="passkeys-heading" className={section}>
      <h2 id="passkeys-heading" className={heading}>
        {t('security.passkeys.title')}
      </h2>
      <p className="text-ink-muted">{t('security.passkeys.body')}</p>
      {passkeys.isError && <FormAlert tone="error">{t(problemMessageKey(passkeys.error))}</FormAlert>}
      {remove.isError && <FormAlert tone="error">{t(problemMessageKey(remove.error))}</FormAlert>}
      {added && <FormAlert tone="success">{t('security.passkeys.added')}</FormAlert>}
      {passkeys.data &&
        (passkeys.data.length === 0 ? (
          <p className="text-ink-muted">{t('security.passkeys.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {passkeys.data.map((passkey) => (
              <li key={passkey.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink-strong">{passkey.name}</span>
                  <span className="text-sm text-ink-muted">
                    {t('security.passkeys.created').replace(
                      '{date}',
                      formatDateTime(passkey.createdAt, locale),
                    )}
                    {' · '}
                    {passkey.lastUsedAt
                      ? t('security.passkeys.lastUsed').replace(
                          '{date}',
                          formatDateTime(passkey.lastUsedAt, locale),
                        )
                      : t('security.passkeys.neverUsed')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 px-3 text-sm"
                    aria-label={`${t('security.passkeys.rename')}: ${passkey.name}`}
                    onClick={() => {
                      setRenaming(passkey);
                    }}
                  >
                    {t('security.passkeys.rename')}
                  </Button>
                  <Confirm
                    trigger={t('security.passkeys.remove')}
                    triggerLabel={`${t('security.passkeys.remove')}: ${passkey.name}`}
                    small
                    title={t('security.passkeys.removeTitle').replace('{name}', passkey.name)}
                    body={t('security.passkeys.removeBody')}
                    confirm={t('security.passkeys.remove')}
                    busy={remove.isPending}
                    onConfirm={() => remove.mutateAsync(passkey.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        ))}
      {supported === false && <p className="text-sm text-ink-muted">{t('security.passkeys.unsupported')}</p>}
      {supported && (
        <AddPasskey
          defaultName={thisDevice}
          onAdded={() => {
            setAdded(true);
          }}
        />
      )}
      {renaming && (
        <RenamePasskey
          passkey={renaming}
          onClose={() => {
            setRenaming(undefined);
          }}
        />
      )}
    </section>
  );
}

const addSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .max(passkeyNameMaxLength, 'validation.passkeyNameTooLong'),
  password: z.string().min(1, 'validation.required'),
});
type AddValues = z.infer<typeof addSchema>;

function AddPasskey({ defaultName, onAdded }: Readonly<{ defaultName: string; onAdded: () => void }>) {
  const { t } = useLocale();
  const add = useAddPasskey();
  const [open, setOpen] = useState(false);
  const form = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: defaultName.slice(0, passkeyNameMaxLength), password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync({ name: values.name, password: values.password });
      setOpen(false);
      form.reset();
      onAdded();
    } catch (error) {
      if (error instanceof PasskeyCancelled) {
        // Closed the browser's window: the form stays, nothing to say.
        return;
      }
      if (error instanceof PasskeyAlreadyRegistered) {
        form.setError('root', { type: 'server', message: 'security.passkeys.alreadyRegistered' });
        return;
      }
      showProblem(error, ['name', 'password'], form.setError, {
        'User.PasswordIncorrect': 'password',
        'Passkey.NameInvalid': 'name',
      });
    }
  });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          form.reset({ name: defaultName.slice(0, passkeyNameMaxLength), password: '' });
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button className="self-start">{t('security.passkeys.add')}</Button>
      </Dialog.Trigger>
      <DialogFrame title={t('security.passkeys.addTitle')} description={t('security.passkeys.addBody')}>
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
          <TextField
            label={t('security.passkeys.name')}
            autoComplete="off"
            maxLength={passkeyNameMaxLength}
            error={messageOf(t, errors.name?.message)}
            {...form.register('name')}
          />
          <TextField
            label={t('account.currentPassword')}
            type="password"
            autoComplete="current-password"
            error={messageOf(t, errors.password?.message)}
            {...form.register('password')}
          />
          <DialogButtons busy={isSubmitting} submit={t('security.passkeys.addSubmit')} />
        </form>
      </DialogFrame>
    </Dialog.Root>
  );
}

const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .max(passkeyNameMaxLength, 'validation.passkeyNameTooLong'),
});
type RenameValues = z.infer<typeof renameSchema>;

function RenamePasskey({ passkey, onClose }: Readonly<{ passkey: Passkey; onClose: () => void }>) {
  const { t } = useLocale();
  const rename = useRenamePasskey();
  const form = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: passkey.name },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await rename.mutateAsync({ id: passkey.id, name: values.name });
      onClose();
    } catch (error) {
      showProblem(error, ['name'], form.setError, { 'Passkey.NameInvalid': 'name' });
    }
  });

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogFrame title={t('security.passkeys.renameTitle')}>
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
          <TextField
            label={t('security.passkeys.name')}
            autoComplete="off"
            maxLength={passkeyNameMaxLength}
            error={messageOf(t, errors.name?.message)}
            {...form.register('name')}
          />
          <DialogButtons busy={isSubmitting} submit={t('security.passkeys.renameSubmit')} />
        </form>
      </DialogFrame>
    </Dialog.Root>
  );
}

function SignInAlerts() {
  const { t } = useLocale();
  const id = useId();
  const preferences = useNotificationPreferences(true);
  const change = useSetNotificationPreferences();

  return (
    <section aria-labelledby="alerts-heading" className={section}>
      <h2 id="alerts-heading" className={heading}>
        {t('security.alerts.title')}
      </h2>
      {preferences.isError && <FormAlert tone="error">{t(problemMessageKey(preferences.error))}</FormAlert>}
      {change.isError && <FormAlert tone="error">{t(problemMessageKey(change.error))}</FormAlert>}
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="mt-1 size-5 accent-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
          checked={
            change.isPending ? change.variables.signInAlerts : (preferences.data?.signInAlerts ?? true)
          }
          disabled={!preferences.data || change.isPending}
          onChange={(event) => {
            change.mutate({ signInAlerts: event.target.checked });
          }}
        />
        <label htmlFor={id} className="flex flex-col gap-1">
          <span className="font-semibold text-ink-strong">{t('security.alerts.signIn')}</span>
          <span className="text-sm text-ink-muted">{t('security.alerts.signInHint')}</span>
        </label>
      </div>
    </section>
  );
}

function DialogFrame({
  title,
  description,
  children,
}: Readonly<{ title: string; description?: string; children: ReactNode }>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/75" />
      <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-xl sm:p-8">
        <Dialog.Title className="font-display text-2xl font-bold text-ink-strong">{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="text-ink">{description}</Dialog.Description>
        ) : (
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
        )}
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

function DialogButtons({ busy, submit }: Readonly<{ busy: boolean; submit: string }>) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={busy}>
        {busy ? t('auth.working') : submit}
      </Button>
      <Dialog.Close asChild>
        <Button variant="ghost">{t('account.cancel')}</Button>
      </Dialog.Close>
    </div>
  );
}

/** A change that cannot be taken back, behind a question; the dialog closes once it is done. */
function Confirm({
  trigger,
  triggerLabel,
  small = false,
  title,
  body,
  confirm,
  busy,
  onConfirm,
}: Readonly<{
  trigger: string;
  triggerLabel?: string;
  small?: boolean;
  title: string;
  body: string;
  confirm: string;
  busy: boolean;
  onConfirm: () => Promise<unknown>;
}>) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="secondary"
          className={small ? 'h-9 px-3 text-sm' : 'self-start'}
          aria-label={triggerLabel}
        >
          {trigger}
        </Button>
      </Dialog.Trigger>
      <DialogFrame title={title} description={body}>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={danger}
            disabled={busy}
            onClick={() => {
              void onConfirm()
                .then(() => {
                  setOpen(false);
                })
                .catch(() => {
                  // The section shows the error; the dialog closes so it can be read.
                  setOpen(false);
                });
            }}
          >
            {busy ? t('auth.working') : confirm}
          </button>
          <Dialog.Close asChild>
            <Button variant="ghost">{t('account.cancel')}</Button>
          </Dialog.Close>
        </div>
      </DialogFrame>
    </Dialog.Root>
  );
}
