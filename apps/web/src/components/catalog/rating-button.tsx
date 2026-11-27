'use client';

import { problemMessageKey, useRateTitle, useRating, type RatingLevel } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState } from 'react';
import { useLocale } from '../../i18n/translator';
import { useWatchingProfile } from '../../profiles/profile-selection';

const levels: readonly RatingLevel[] = ['NotForMe', 'Like', 'Love'];

const symbols: Record<RatingLevel, string> = { NotForMe: '👎', Like: '👍', Love: '👍👍' };

/**
 * Rates the title for the watching profile: a thumb that opens the three levels, the chosen one marked, and
 * taking the rating back. On a title's page the button names the current rating; on a card it is asked when
 * the menu opens. The rating shapes the profile's recommendations. Shown only for a signed-in profile;
 * Streaming's refusal (age, not watchable) is said under it.
 */
export function RatingButton({
  titleId,
  title,
  variant,
}: Readonly<{ titleId: string; title: string; variant: 'card' | 'hero' }>) {
  const { t } = useLocale();
  const profileId = useWatchingProfile();
  const [open, setOpen] = useState(false);
  // A card asks when its menu opens; a title's page shows the rating on the button at once.
  const rating = useRating(profileId, titleId, variant === 'hero' || open);
  const rate = useRateTitle(profileId);

  if (!profileId) {
    return null;
  }

  const current = rating.data ?? null;
  const error = rate.isError ? t(problemMessageKey(rate.error)) : undefined;
  const label = current
    ? `${t('rating.rateNamed').replace('{title}', title)}: ${t(`rating.${current}`)}`
    : t('rating.rateNamed').replace('{title}', title);

  return (
    <span className="relative">
      <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger
          aria-label={label}
          disabled={variant === 'hero' && rating.isPending}
          className={variant === 'card' ? cardClass : heroClass}
        >
          <span aria-hidden="true">{current ? symbols[current] : '👍'}</span>
          {variant === 'hero' && <span>{current ? t(`rating.${current}`) : t('rating.rate')}</span>}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={8}
            className="z-40 min-w-48 rounded-md border border-line bg-surface p-1 shadow-xl shadow-black/50"
          >
            <DropdownMenu.RadioGroup
              value={current ?? ''}
              onValueChange={(value) => {
                rate.mutate({ titleId, rating: value as RatingLevel });
              }}
            >
              {levels.map((level) => (
                <DropdownMenu.RadioItem key={level} value={level} className={itemClass}>
                  <span aria-hidden="true" className="w-8">
                    {symbols[level]}
                  </span>
                  {t(`rating.${level}`)}
                  <DropdownMenu.ItemIndicator className="ml-auto" aria-hidden="true">
                    ✓
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            {current && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item
                  className={itemClass}
                  onSelect={() => {
                    rate.mutate({ titleId, rating: null });
                  }}
                >
                  {t('rating.remove')}
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && (
        <span
          role="alert"
          className={classNames(
            'absolute top-full z-20 mt-2 w-56 rounded-md bg-surface-raised p-2 text-xs text-ink shadow-lg',
            variant === 'card' ? 'right-0' : 'left-0',
          )}
        >
          {error}
        </span>
      )}
    </span>
  );
}

const itemClass =
  'flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-ink outline-none select-none data-[highlighted]:bg-white/10';

const cardClass =
  'flex size-9 items-center justify-center rounded-full border-2 border-white/70 bg-black/60 text-sm text-white hover:border-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60';

const heroClass = classNames(
  'inline-flex h-12 w-fit items-center gap-2 rounded-md bg-white/20 px-6 font-semibold text-white backdrop-blur-sm',
  'hover:bg-white/30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'disabled:opacity-60',
);
