'use client';

import { useProfiles, useSession } from '@netboxplus/core';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, use, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useLocale } from '../i18n/translator';
import { isAccountPage, profilesPath } from '../routes';
import {
  isStillValid,
  readSelectedProfileCookie,
  selectedProfileCookie,
  type SelectedProfile,
} from './selected-profile';

interface ProfileSelection {
  /** The profile being watched; `undefined` until one is chosen, and while the server renders. */
  readonly selected: SelectedProfile | undefined;
  readonly select: (profile: SelectedProfile) => void;
  readonly clear: () => void;
}

const ProfileSelectionContext = createContext<ProfileSelection | null>(null);

// document.cookie as a store, so every component sees a change at once.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(profile: SelectedProfile | undefined) {
  document.cookie = selectedProfileCookie(profile, window.location.protocol === 'https:');
  for (const listener of listeners) {
    listener();
  }
}

const browserCookies = () => document.cookie;
// The server renders without a choice, so the first render in the browser matches what it sent.
const serverCookies = () => '';

const selection = {
  select: (profile: SelectedProfile) => {
    write(profile);
  },
  clear: () => {
    write(undefined);
  },
};

/**
 * The chosen profile, from its cookie. Once the account's profiles are known, a choice that no longer
 * fits (the profile was removed, or its age limit changed) is dropped, and the visitor chooses again.
 */
export function ProfileSelectionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const profiles = useProfiles(Boolean(session.data));
  const cookies = useSyncExternalStore(subscribe, browserCookies, serverCookies);
  const selected = useMemo(() => readSelectedProfileCookie(cookies), [cookies]);

  useEffect(() => {
    if (!selected || !profiles.data || isStillValid(selected, profiles.data)) {
      return;
    }
    selection.clear();
    if (!isAccountPage(pathname)) {
      router.replace(profilesPath(locale, pathname));
    }
  }, [selected, profiles.data, pathname, router, locale]);

  const value = useMemo(() => ({ selected, ...selection }), [selected]);
  return <ProfileSelectionContext value={value}>{children}</ProfileSelectionContext>;
}

export function useProfileSelection(): ProfileSelection {
  const value = use(ProfileSelectionContext);
  if (!value) {
    throw new Error('useProfileSelection needs a ProfileSelectionProvider above it.');
  }
  return value;
}
