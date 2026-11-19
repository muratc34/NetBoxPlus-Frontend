'use client';

import {
  maxProfiles,
  problemMessageKey,
  safeNextPath,
  useProfiles,
  useSession,
  type Profile,
} from '@netboxplus/core';
import { Button, classNames } from '@netboxplus/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormAlert } from '../components/form';
import { useLocale } from '../i18n/translator';
import { profilesPath, routes, signInPath } from '../routes';
import { ProfileAvatar } from './profile-avatar';
import { ProfileDialog } from './profile-dialog';
import { useProfileSelection } from './profile-selection';

const tile =
  'group flex w-28 flex-col items-center gap-3 rounded-lg p-2 sm:w-36 focus-visible:outline-3 focus-visible:outline-focus';

/**
 * "Who's watching?": choosing a profile goes on to `next` (the home page by default). In managing mode
 * the same tiles open the profile for editing; adding is offered until the account has five.
 */
export function ProfilePicker() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const nextParameter = safeNextPath(useSearchParams().get('next'));
  const next = nextParameter ?? routes.home(locale);
  const session = useSession();
  const profiles = useProfiles(Boolean(session.data));
  const { select } = useProfileSelection();
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<Profile | 'new' | undefined>(undefined);

  useEffect(() => {
    if (session.data === null) {
      router.replace(signInPath(locale, profilesPath(locale, nextParameter)));
    }
  }, [session.data, router, locale, nextParameter]);

  const choose = (profile: Profile) => {
    select({ id: profile.id, maxAgeRating: profile.maxAgeRating });
    router.push(next);
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-12 text-center">
      <h1 className="font-display text-4xl font-bold text-ink-strong sm:text-5xl">
        {t(managing ? 'profiles.manageTitle' : 'profiles.title')}
      </h1>

      {profiles.isError && <FormAlert tone="error">{t(problemMessageKey(profiles.error))}</FormAlert>}
      {!profiles.data && !profiles.isError && (
        <p role="status" className="text-ink-muted">
          {t('profiles.loading')}
        </p>
      )}

      {profiles.data && (
        <ul className="flex max-w-3xl flex-wrap justify-center gap-4 sm:gap-6">
          {profiles.data.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                className={tile}
                aria-label={managing ? `${profile.name}, ${t('profiles.editNamed')}` : undefined}
                onClick={() => {
                  if (managing) {
                    setEditing(profile);
                  } else {
                    choose(profile);
                  }
                }}
              >
                <ProfileAvatar
                  id={profile.id}
                  name={profile.name}
                  className={classNames(
                    'size-24 text-4xl ring-ink-strong transition group-hover:ring-3 group-focus-visible:ring-3 sm:size-32 sm:text-5xl',
                    managing && 'opacity-60',
                  )}
                />
                <span className="max-w-full truncate text-ink-muted group-hover:text-ink-strong">
                  {profile.name}
                </span>
              </button>
            </li>
          ))}
          {profiles.data.length < maxProfiles && (
            <li>
              <button
                type="button"
                className={tile}
                onClick={() => {
                  setEditing('new');
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-24 items-center justify-center rounded-md border-2 border-line text-5xl text-ink-muted group-hover:border-ink-strong group-hover:text-ink-strong sm:size-32"
                >
                  +
                </span>
                <span className="text-ink-muted group-hover:text-ink-strong">{t('profiles.add')}</span>
              </button>
            </li>
          )}
        </ul>
      )}

      {profiles.data && profiles.data.length >= maxProfiles && (
        <p className="text-sm text-ink-muted">{t('profiles.limit')}</p>
      )}

      {profiles.data && (
        <Button
          variant="secondary"
          onClick={() => {
            setManaging(!managing);
          }}
        >
          {t(managing ? 'profiles.done' : 'profiles.manage')}
        </Button>
      )}

      {editing && (
        <ProfileDialog
          profile={editing === 'new' ? undefined : editing}
          onClose={() => {
            setEditing(undefined);
          }}
        />
      )}
    </main>
  );
}
