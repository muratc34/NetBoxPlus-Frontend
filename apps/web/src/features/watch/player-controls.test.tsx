import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { gatewayUrl, problem, server } from '../../test/render';
import { FakeHls, playerFakes, playAt, player, setUpPlayerTests, streaming, video } from '../../test/player';
import { nextCardSeconds, volumeStep } from './player';

vi.mock('hls.js', async () => ({ default: (await import('../../test/player')).FakeHls }));

setUpPlayerTests();

/** The player with its session open and hls.js attached. */
async function attached(props: Parameters<typeof player>[0] = {}) {
  streaming();
  const view = player(props);
  await waitFor(() => {
    expect(playerFakes.created).toHaveLength(1);
  });
  const hls = playerFakes.created[0];
  if (!hls) {
    throw new Error('No hls.js');
  }
  return { view, hls };
}

/** What the player keeps for the profile, in order. */
function preferences() {
  const saved: unknown[] = [];
  server.use(
    http.put(`${gatewayUrl}/streaming/profiles/p1/playback-preferences`, async ({ request }) => {
      saved.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return saved;
}

const settings = () => screen.getByRole('button', { name: 'Ses, altyazı ve kalite' });

async function openSettings() {
  await userEvent.setup().click(settings());
  return screen.findByRole('menu');
}

/** The `index`th of `items`, which must be there. */
function nth(items: HTMLElement[], index: number): HTMLElement {
  const item = items[index];
  if (!item) {
    throw new Error(`No item ${String(index)}.`);
  }
  return item;
}

/** The choices in the menu, in order, by their accessible names. */
function choices(menu: HTMLElement, onlyChecked = false) {
  return within(menu)
    .getAllByRole('menuitemradio')
    .filter((item) => !onlyChecked || item.getAttribute('aria-checked') === 'true')
    .map((item) => item.textContent.replace('●', ''));
}

describe('the settings menu', () => {
  it('offers the languages and qualities the stream has, the current ones checked', async () => {
    const { hls } = await attached();
    act(() => {
      hls.parse({
        audio: ['tr-TR', 'en-US'],
        subtitles: ['tr-TR', 'en-US', 'en-GB'],
        heights: [360, 1080, 720],
        playing: 2,
      });
    });

    const menu = await openSettings();

    expect(choices(menu)).toEqual([
      'Türkçe',
      'İngilizce',
      'Kapalı',
      'Türkçe',
      'Amerikan İngilizcesi',
      'İngiliz İngilizcesi',
      'Otomatik (720p)',
      '1080p',
      '720p',
      '360p',
    ]);
    expect(choices(menu, true)).toEqual(['Türkçe', 'Kapalı', 'Otomatik (720p)']);
    expect(within(menu).getAllByRole('menuitemradio', { name: 'Türkçe' })).toHaveLength(2);
  });

  it('switches the audio and the subtitles and keeps both for the profile', async () => {
    const saved = preferences();
    const { hls } = await attached();
    act(() => {
      hls.parse({ audio: ['tr-TR', 'en-US'], subtitles: ['tr-TR', 'en-US'] });
    });
    const user = userEvent.setup();

    const english = async () =>
      within(await openSettings()).getAllByRole('menuitemradio', { name: 'İngilizce' });
    await user.click(nth(await english(), 0));
    expect(hls.audioTrack).toBe(1);
    const turkish = within(await openSettings()).getAllByRole('menuitemradio', { name: 'Türkçe' });
    await user.click(nth(turkish, 1));
    expect(hls.subtitleTrack).toBe(0);
    await user.click(nth(within(await openSettings()).getAllByRole('menuitemradio', { name: 'Kapalı' }), 0));
    expect(hls.subtitleTrack).toBe(-1);

    await waitFor(() => {
      expect(saved).toEqual([
        { audioLanguage: 'en-US', subtitleLanguage: null },
        { audioLanguage: 'en-US', subtitleLanguage: 'tr-TR' },
        { audioLanguage: 'en-US', subtitleLanguage: null },
      ]);
    });
  });

  it('picks a quality or leaves it to hls.js, without keeping it', async () => {
    const saved = preferences();
    const { hls } = await attached();
    act(() => {
      hls.parse({ heights: [360, 720], playing: 1 });
    });
    const user = userEvent.setup();

    await user.click(within(await openSettings()).getByRole('menuitemradio', { name: '360p' }));
    expect(hls.currentLevel).toBe(0);
    expect(hls.autoLevelEnabled).toBe(false);
    expect(choices(await openSettings(), true)).toEqual(['360p']);
    await user.click(screen.getByRole('menuitemradio', { name: 'Otomatik' }));
    expect(hls.autoLevelEnabled).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(saved).toEqual([]);
  });

  it('leaves out a group with nothing to choose', async () => {
    const { hls } = await attached();
    act(() => {
      hls.parse({ audio: ['tr-TR'], subtitles: ['en-US'], heights: [720] });
    });

    expect(choices(await openSettings())).toEqual(['Kapalı', 'İngilizce']);
  });

  it('is not there with nothing to choose', async () => {
    const { hls } = await attached();
    act(() => {
      hls.parse({ audio: ['tr-TR'], heights: [720] });
    });

    expect(screen.queryByRole('button', { name: 'Ses, altyazı ve kalite' })).not.toBeInTheDocument();
  });

  it('keeps open while the video plays, and goes with hls.js', async () => {
    const { hls, view } = await attached({ hideAfterMs: 30 });
    act(() => {
      hls.parse({ audio: ['tr-TR', 'en-US'] });
    });
    playAt(10);
    await openSettings();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(screen.getByRole('region', { name: 'Oynatıcı' })).not.toHaveClass('cursor-none');
    view.unmount();
  });
});

describe('keyboard shortcuts', () => {
  async function keyed() {
    const result = await attached();
    playAt(600);
    return result;
  }

  it('play and pause with Space and K', async () => {
    await keyed();
    const user = userEvent.setup();

    await user.keyboard(' ');
    expect(playerFakes.pause).toHaveBeenCalledTimes(1);
    await user.keyboard('k');
    expect(video().paused).toBe(false);
  });

  it('skip with the arrows and change the volume, within its range', async () => {
    await keyed();
    const user = userEvent.setup();

    await user.keyboard('{ArrowLeft}');
    expect(video().currentTime).toBe(590);
    fireEvent.timeUpdate(video());
    await user.keyboard('{ArrowRight}');
    expect(video().currentTime).toBe(600);

    video().volume = 0.5;
    fireEvent.volumeChange(video());
    await user.keyboard('{ArrowUp}');
    expect(video().volume).toBeCloseTo(0.5 + volumeStep);
    video().volume = 0.05;
    fireEvent.volumeChange(video());
    await user.keyboard('{ArrowDown}');
    expect(video().volume).toBe(0);
    expect(video().muted).toBe(true);

    video().volume = 0.8;
    video().muted = true;
    fireEvent.volumeChange(video());
    await user.keyboard('{ArrowUp}');
    expect(video().volume).toBeCloseTo(volumeStep);
    expect(video().muted).toBe(false);
  });

  it('mute with M and go full screen with F', async () => {
    const request = vi.fn(() => Promise.resolve());
    HTMLElement.prototype.requestFullscreen = request;
    await keyed();
    const user = userEvent.setup();

    await user.keyboard('m');
    expect(video().muted).toBe(true);
    await user.keyboard('M');
    expect(video().muted).toBe(false);
    await user.keyboard('f');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('turn subtitles on and off with C, back to the last ones chosen', async () => {
    const saved = preferences();
    const { hls } = await keyed();
    act(() => {
      hls.parse({ audio: ['tr-TR'], subtitles: ['tr-TR', 'en-US'] });
    });
    const user = userEvent.setup();

    await user.keyboard('c');
    expect(hls.subtitleTrack).toBe(0);
    await user.keyboard('c');
    expect(hls.subtitleTrack).toBe(-1);
    await user.keyboard('c');
    expect(hls.subtitleTrack).toBe(0);
    await user.click(within(await openSettings()).getByRole('menuitemradio', { name: 'İngilizce' }));
    await user.keyboard('{Escape}');
    await user.keyboard('C');
    expect(hls.subtitleTrack).toBe(-1);
    await user.keyboard('c');
    expect(hls.subtitleTrack).toBe(1);
    await waitFor(() => {
      expect(saved).toHaveLength(6);
    });
  });

  it('leave C alone without subtitles', async () => {
    const saved = preferences();
    const { hls } = await keyed();
    act(() => {
      hls.parse({ audio: ['tr-TR', 'en-US'] });
    });

    const event = fireEvent.keyDown(window, { key: 'c' });

    expect(event).toBe(true);
    expect(hls.subtitleTrack).toBe(-1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(saved).toEqual([]);
  });

  it('leave the sliders their arrows, buttons their keys, links and modified keys alone', async () => {
    await keyed();

    const timeline = screen.getByRole('slider', { name: 'Zaman çubuğu' });
    expect(fireEvent.keyDown(timeline, { key: 'ArrowLeft' })).toBe(true);
    expect(video().currentTime).toBe(600);
    expect(fireEvent.keyDown(timeline, { key: ' ' })).toBe(false);

    const back = screen.getByRole('button', { name: '10 saniye geri' });
    expect(fireEvent.keyDown(back, { key: ' ' })).toBe(true);
    expect(fireEvent.keyDown(back, { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(back, { key: 'ArrowRight' })).toBe(false);
    expect(fireEvent.keyDown(screen.getByRole('link', { name: 'Geri dön' }), { key: 'k' })).toBe(true);
    playerFakes.pause.mockClear();
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: 'k', altKey: true })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: 'k', metaKey: true })).toBe(true);
    expect(playerFakes.pause).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(window, { key: 'x' })).toBe(true);
  });

  it('leave the settings menu its own keys', async () => {
    const { hls } = await keyed();
    act(() => {
      hls.parse({ audio: ['tr-TR', 'en-US'] });
    });

    const item = nth(within(await openSettings()).getAllByRole('menuitemradio'), 1);
    expect(fireEvent.keyDown(item, { key: 'k' })).toBe(true);
    expect(playerFakes.pause).not.toHaveBeenCalled();
  });

  it('stop while the video cannot be played', async () => {
    const { hls } = await keyed();
    act(() => {
      hls.fail('networkError');
    });
    await screen.findByRole('dialog');

    expect(fireEvent.keyDown(document.body, { key: 'k' })).toBe(true);
    expect(playerFakes.pause).not.toHaveBeenCalled();
  });

  it('do nothing before the session opens or while a problem is shown', async () => {
    const calls = streaming({ start: () => problem(409, 'Playback.TooManyScreens') });
    player();

    expect(fireEvent.keyDown(window, { key: ' ' })).toBe(true);
    await screen.findByRole('dialog');
    expect(fireEvent.keyDown(window, { key: 'k' })).toBe(true);
    expect(calls).toEqual(['start c1 for p1']);
  });
});

describe('hiding the controls', () => {
  const region = () => screen.getByRole('region', { name: 'Oynatıcı' });

  it('hides them and the pointer while the video plays untouched, and brings them back on movement', async () => {
    await attached({ hideAfterMs: 40 });
    playAt(10);

    await waitFor(() => {
      expect(region()).toHaveClass('cursor-none');
    });
    expect(screen.getByRole('button', { name: 'Duraklat' }).closest('.opacity-0')).not.toBeNull();

    fireEvent.pointerMove(region());
    expect(region()).not.toHaveClass('cursor-none');
    await waitFor(() => {
      expect(region()).toHaveClass('cursor-none');
    });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(region()).not.toHaveClass('cursor-none');
    await waitFor(() => {
      expect(region()).toHaveClass('cursor-none');
    });
    fireEvent.focusIn(screen.getByRole('button', { name: 'Duraklat' }));
    expect(region()).not.toHaveClass('cursor-none');
  });

  it('brings them back when the video pauses', async () => {
    await attached({ hideAfterMs: 40 });
    playAt(10);
    await waitFor(() => {
      expect(region()).toHaveClass('cursor-none');
    });

    act(() => {
      video().pause();
    });

    expect(region()).not.toHaveClass('cursor-none');
  });

  it('keeps them while paused', async () => {
    await attached({ hideAfterMs: 30 });
    playAt(10);
    video().pause();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(region()).not.toHaveClass('cursor-none');
  });

  it('shows them on a tap instead of pausing', async () => {
    await attached({ hideAfterMs: 40 });
    playAt(10);
    await waitFor(() => {
      expect(region()).toHaveClass('cursor-none');
    });
    playerFakes.pause.mockClear();

    const tap = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(tap, 'pointerType', { value: 'touch' });
    fireEvent(video(), tap);

    expect(region()).not.toHaveClass('cursor-none');
    expect(playerFakes.pause).not.toHaveBeenCalled();
    fireEvent.click(video());
    expect(playerFakes.pause).toHaveBeenCalledTimes(1);
  });
});

describe('the next episode', () => {
  const next = { label: 'S1:B3 · İlk Hasat', onPlay: vi.fn() };

  it(`is offered in the last ${String(nextCardSeconds)} seconds and plays now when asked`, async () => {
    next.onPlay.mockReset();
    await attached({ next });

    playAt(1800 - nextCardSeconds - 1);
    expect(screen.queryByRole('region', { name: 'Sıradaki bölüm' })).not.toBeInTheDocument();
    playAt(1790);
    expect(screen.getByRole('region', { name: 'Sıradaki bölüm' })).toHaveTextContent('10 sn');
    playAt(1792.2);

    const card = screen.getByRole('region', { name: 'Sıradaki bölüm' });
    expect(card).toHaveTextContent('Sıradaki: S1:B3 · İlk Hasat');
    expect(card).toHaveTextContent('8 sn içinde başlıyor');
    await userEvent.setup().click(within(card).getByRole('button', { name: 'Şimdi oynat' }));
    expect(next.onPlay).toHaveBeenCalledTimes(1);
  });

  it('plays when the episode ends', async () => {
    next.onPlay.mockReset();
    await attached({ next });
    playAt(1799);

    fireEvent.ended(video());

    expect(next.onPlay).toHaveBeenCalledTimes(1);
    expect(playerFakes.finished).not.toHaveBeenCalled();
  });

  it('is not played once dismissed: the player finishes instead', async () => {
    next.onPlay.mockReset();
    await attached({ next });
    playAt(1795);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('region', { name: 'Sıradaki bölüm' })).not.toBeInTheDocument();
    fireEvent.ended(video());

    expect(next.onPlay).not.toHaveBeenCalled();
    expect(playerFakes.finished).toHaveBeenCalledTimes(1);
  });

  it('is not offered before the length is known', async () => {
    await attached({ next });
    playAt(0, Number.NaN);

    expect(screen.queryByRole('region', { name: 'Sıradaki bölüm' })).not.toBeInTheDocument();
  });
});

describe('FakeHls', () => {
  it('is what the player takes for hls.js', () => {
    expect(FakeHls.isSupported()).toBe(true);
  });
});
