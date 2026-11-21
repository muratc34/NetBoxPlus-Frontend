import { can, useAdminSession } from '../data/session';
import { useContentName } from '../data/titles';
import type { ContentKind } from '../data/videos';
import { useLocale } from '../i18n';

const readPermission: Record<ContentKind, string> = {
  Movie: 'catalog:movies:read',
  Series: 'catalog:series:read',
  Episode: 'catalog:series:read',
};

/** What a video belongs to: the kind, and the movie's or series' title when Catalog gives it ("Dizi · Rüzgarın Kızı"). */
export function ContentName({ kind, id }: Readonly<{ kind: ContentKind; id: string }>) {
  const { t } = useLocale();
  const session = useAdminSession();
  const title = useContentName(kind, id, can(session.data, readPermission[kind]));
  const label = t(`admin.videos.kind.${kind}`);
  return <>{title ? `${label} · ${title}` : label}</>;
}
