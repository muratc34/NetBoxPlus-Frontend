import type { Metadata } from 'next';
import { Suspense } from 'react';
import { pageTitle } from '../../../i18n/server';
import { ProfilePicker } from '../../../profiles/profile-picker';

export async function generateMetadata({ params }: PageProps<'/[lang]/profiles'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'profiles.title'), robots: { index: false } };
}

export default function ProfilesPage() {
  return (
    // The picker reads `next` from the query string, which a static page only has in the browser.
    <Suspense>
      <ProfilePicker />
    </Suspense>
  );
}
