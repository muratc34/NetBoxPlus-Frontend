import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useProgress } from '@netboxplus/core';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { gatewayUrl, navigation, problem, renderPage, server } from '../../test/render';
import { FakeHls, playerFakes, playAt, player, setUpPlayerTests, streaming, video } from '../../test/player';
import { formatClock, Player } from './player';

vi.mock('hls.js', async () => ({ default: (await import('../../test/player')).FakeHls }));

setUpPlayerTests();
const players = playerFakes;
const finished = playerFakes.finished;

describe('formatClock', () => {
  it('writes minutes and seconds, and hours when there are', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(-4)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});

describe('Player', () => {
  it('opens one session, even when mounted twice in strict mode, and plays from where the profile stopped', async () => {
    const calls = streaming();
    player();

    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    const hls = players.created[0];
    expect(hls?.config.startPosition).toBe(95);
    expect(hls?.source).toBe(`${gatewayUrl}/streaming/playback/s1/master.m3u8?sig=x`);
    expect(hls?.media).toBe(video());
    expect(calls).toEqual(['start c1 for p1']);
    expect(screen.getByRole('heading', { name: 'Kuzey Işığı' })).toBeInTheDocument();
  });

  it('starts over when asked', async () => {
    streaming();
    player({ fromStart: true });

    await waitFor(() => {
      expect(players.created[0]?.config.startPosition).toBe(0);
    });
  });

  it('beats with the position, and ends the session with it when it goes', async () => {
    const calls = streaming({ heartbeatSeconds: 0.05 });
    const { unmount } = player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });

    playAt(42.4);
    await waitFor(() => {
      expect(calls).toContain('beat s1 42');
    });
    unmount();

    await waitFor(() => {
      expect(calls.at(-1)).toBe('end s1 42');
    });
    const beats = calls.filter((call) => call.startsWith('beat')).length;
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(calls.filter((call) => call.startsWith('beat'))).toHaveLength(beats);
  });

  it("asks for the profile's progress again once the session has ended", async () => {
    const calls = streaming();
    let asked = 0;
    server.use(
      http.get(`${gatewayUrl}/streaming/profiles/p1/progress`, () => {
        asked++;
        return HttpResponse.json([]);
      }),
    );
    function Watching() {
      const [open, setOpen] = useState(true);
      useProgress('p1', 'c1');
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
          >
            close
          </button>
          {open && (
            <Player
              profileId="p1"
              contentId="c1"
              fromStart={false}
              heading="Kuzey Işığı"
              backHref="/tr/movies/c1"
              onFinished={finished}
            />
          )}
        </>
      );
    }
    renderPage(<Watching />, 'tr', { withProfiles: false });
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    expect(asked).toBe(1);

    await userEvent.setup().click(screen.getByRole('button', { name: 'close' }));

    await waitFor(() => {
      expect(asked).toBe(2);
    });
    expect(calls.at(-1)).toBe('end s1 95');
  });

  it('keeps the place it was going to start from when it goes before playing', async () => {
    const calls = streaming();
    const { unmount } = player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });

    unmount();

    await waitFor(() => {
      expect(calls).toEqual(['start c1 for p1', 'end s1 95']);
    });
  });

  it('says where it paused or jumped to at once, but not more often than every few seconds', async () => {
    const calls = streaming();
    player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    playAt(120);

    video().pause();
    fireEvent.seeked(video());

    await waitFor(() => {
      expect(calls).toEqual(['start c1 for p1', 'beat s1 120']);
    });
  });

  it('ends the session as the page goes away, once', async () => {
    const calls = streaming();
    const { unmount } = player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    playAt(300);

    window.dispatchEvent(new Event('pagehide'));
    await waitFor(() => {
      expect(calls).toContain('end s1 300');
    });
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(calls.filter((call) => call.startsWith('end'))).toEqual(['end s1 300']);
  });

  it('starts a new session when the page comes back from the history', async () => {
    const calls = streaming();
    player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });

    window.dispatchEvent(new Event('pagehide'));
    const back = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(back, 'persisted', { value: true });
    window.dispatchEvent(back);

    await waitFor(() => {
      expect(calls).toEqual(['start c1 for p1', 'end s1 95', 'start c1 for p1']);
    });
    const plain = new Event('pageshow');
    window.dispatchEvent(plain);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls.filter((call) => call.startsWith('start'))).toHaveLength(2);
  });

  it('stops when Streaming ends the session, and starts again on request', async () => {
    let ended = false;
    const calls = streaming({
      heartbeatSeconds: 0.03,
      beat: () => (ended ? new HttpResponse(null, { status: 204 }) : problem(404, 'Playback.SessionEnded')),
    });
    player();

    const dialog = await screen.findByRole('dialog', { name: 'Oynatılamıyor' });
    expect(dialog).toHaveTextContent('Oynatma sona erdi.');
    expect(players.created[0]?.destroyed).toBe(true);
    ended = true;
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Tekrar dene' }));

    await waitFor(() => {
      expect(calls.filter((call) => call.startsWith('start'))).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // The ended session is not ended again.
    expect(calls.filter((call) => call.startsWith('end'))).toEqual([]);
  });

  it('stops when the membership ends while it plays', async () => {
    streaming({ heartbeatSeconds: 0.03, beat: () => problem(403, 'Playback.SubscriptionRequired') });
    player();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('İzlemek için aktif bir üyelik gerekiyor.');
    expect(within(dialog).getByRole('link', { name: 'Planları gör' })).toHaveAttribute('href', '/tr/plans');
  });

  it('starts the next session only once the last one, of any player, has ended', async () => {
    const calls = streaming({ endDelayMs: 150 });
    const { unmount } = player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    unmount();
    player({ contentId: 'c2' });

    await waitFor(() => {
      expect(calls).toEqual(['start c1 for p1', 'end s1 95', 'ended s1', 'start c2 for p1']);
    });
  });

  it('never plays a session it asked for before its content changed', async () => {
    const calls = streaming({ startDelayMs: 100 });
    function Switching() {
      const [contentId, setContentId] = useState('c1');
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setContentId('c2');
            }}
          >
            next
          </button>
          <Player
            profileId="p1"
            contentId={contentId}
            fromStart={false}
            heading="Dizi"
            backHref="/tr/series/x"
            onFinished={finished}
          />
        </>
      );
    }
    renderPage(<Switching />, 'tr', { withProfiles: false });
    await waitFor(() => {
      expect(calls).toEqual(['start c1 for p1']);
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'next' }));

    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(players.created.map((hls) => hls.source)).toEqual([
      `${gatewayUrl}/streaming/playback/s2/master.m3u8?sig=x`,
    ]);
    expect(calls).toEqual(['start c1 for p1', 'end s1 95', 'start c2 for p1']);
  });

  it('keeps going through a heartbeat that does not arrive', async () => {
    const calls = streaming({ heartbeatSeconds: 0.03, beat: () => HttpResponse.error() });
    player();

    await waitFor(() => {
      expect(calls.filter((call) => call.startsWith('beat')).length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    [
      'Playback.SubscriptionRequired',
      403,
      'İzlemek için aktif bir üyelik gerekiyor.',
      ['Planları gör', '/tr/plans'],
    ],
    [
      'Playback.AgeRestricted',
      403,
      'Bu başlık bu profilin yaş sınırının üstünde.',
      ['Profil değiştir', '/tr/profiles?next=%2Ftr%2Fwatch%2Fc1%3Fepisode%3De1'],
    ],
    ['Playback.ProfileNotFound', 404, 'Bu profil artık yok.', ['Profil değiştir', '/tr/profiles?next=']],
    ['Playback.TooManyScreens', 409, 'Planının izin verdiği sayıda ekranda', ['Hesabım', '/tr/account']],
  ] as const)('says why it cannot start (%s) and what helps', async (code, status, text, [label, href]) => {
    navigation.search = new URLSearchParams({ episode: 'e1' });
    streaming({ start: () => problem(status, code) });
    player();

    const dialog = await screen.findByRole('dialog', { name: 'Oynatılamıyor' });
    expect(dialog).toHaveTextContent(text);
    expect(within(dialog).getByRole('link', { name: label }).getAttribute('href')).toContain(href);
    expect(within(dialog).getByRole('link', { name: 'Geri dön' })).toHaveAttribute('href', '/tr/movies/c1');
    expect(within(dialog).queryAllByRole('button', { name: 'Tekrar dene' })).toHaveLength(
      code === 'Playback.TooManyScreens' ? 1 : 0,
    );
  });

  it('offers only going back for what cannot be watched, and goes back when the dialog closes', async () => {
    streaming({ start: () => problem(404, 'Playback.NotAvailable') });
    player();

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Geri dön']);
    expect(within(dialog).queryByRole('button')).not.toBeInTheDocument();
    await userEvent.setup().keyboard('{Escape}');

    expect(navigation.push).toHaveBeenCalledWith('/tr/movies/c1');
  });

  it('offers trying again for anything else', async () => {
    const calls = streaming({ start: () => problem(503, 'Data.Unavailable') });
    player();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Şu an buna ulaşılamıyor.');
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Tekrar dene' }));

    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
  });

  it('recovers from a media error once, then says the video cannot be played and tries again', async () => {
    const calls = streaming();
    player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    const first = players.created[0];

    act(() => {
      first?.fail('mediaError');
    });
    expect(first?.recovered).toBe(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      first?.fail('mediaError');
    });

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Video oynatılamadı.');
    expect(first?.destroyed).toBe(true);
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Tekrar dene' }));

    await waitFor(() => {
      expect(players.created).toHaveLength(2);
    });
    expect(calls).toEqual(['start c1 for p1', 'end s1 95', 'start c1 for p1']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('plays on through errors hls.js handles itself', async () => {
    streaming();
    player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });

    act(() => {
      players.created[0]?.handlers.get('hlsError')?.('hlsError', { fatal: false, type: 'networkError' });
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(players.created[0]?.destroyed).toBe(false);
  });

  it('gives up at once on a network error', async () => {
    streaming();
    player();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });

    act(() => {
      players.created[0]?.fail('networkError');
    });

    expect(await screen.findByRole('dialog')).toHaveTextContent('Video oynatılamadı.');
    expect(players.created[0]?.recovered).toBe(0);
  });

  it('plays the playlist itself where the browser can (Safari), from where the profile stopped', async () => {
    FakeHls.supported = false;
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
    streaming();
    player();

    await waitFor(() => {
      expect(video().getAttribute('src')).toBe(`${gatewayUrl}/streaming/playback/s1/master.m3u8?sig=x`);
    });
    Object.defineProperty(video(), 'currentTime', { configurable: true, writable: true, value: 0 });
    fireEvent.loadedMetadata(video());
    expect(video().currentTime).toBe(95);
  });

  it('says so where the browser cannot play the stream', async () => {
    FakeHls.supported = false;
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
    streaming();
    player();

    expect(await screen.findByRole('dialog')).toHaveTextContent('Video oynatılamadı.');
  });

  it('plays, pauses, skips, seeks and mutes from its controls', async () => {
    streaming();
    player();
    const user = userEvent.setup();
    const play = await screen.findByRole('button', { name: 'Oynat' });
    // The video is attached (and started) once hls.js has loaded.
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    playAt(600);
    // The first play() was the automatic start.
    playerFakes.pause.mockClear();

    await user.click(screen.getByRole('button', { name: 'Duraklat' }));
    expect(playerFakes.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Oynat' })).toBe(play);

    await user.click(screen.getByRole('button', { name: '10 saniye geri' }));
    expect(video().currentTime).toBe(590);
    fireEvent.timeUpdate(video());
    await user.click(screen.getByRole('button', { name: '10 saniye ileri' }));
    expect(video().currentTime).toBe(600);
    fireEvent.timeUpdate(video());

    const timeline = screen.getByRole('slider', { name: 'Zaman çubuğu' });
    expect(timeline).toHaveAttribute('aria-valuetext', '10:00 / 30:00');
    fireEvent.change(timeline, { target: { value: '1795' } });
    expect(video().currentTime).toBe(1795);
    fireEvent.timeUpdate(video());
    await user.click(screen.getByRole('button', { name: '10 saniye ileri' }));
    expect(video().currentTime).toBe(1800);
    fireEvent.change(timeline, { target: { value: '4' } });
    fireEvent.timeUpdate(video());
    await user.click(screen.getByRole('button', { name: '10 saniye geri' }));
    expect(video().currentTime).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Sesi kapat' }));
    expect(video().muted).toBe(true);
    fireEvent.volumeChange(video());
    expect(screen.getByRole('slider', { name: 'Ses düzeyi' })).toHaveValue('0');
    await user.click(screen.getByRole('button', { name: 'Sesi aç' }));
    expect(video().muted).toBe(false);
    fireEvent.change(screen.getByRole('slider', { name: 'Ses düzeyi' }), { target: { value: '0' } });
    expect(video().muted).toBe(true);
  });

  it('goes full screen and back', async () => {
    streaming();
    const request = vi.fn(() => Promise.resolve());
    const exit = vi.fn(() => Promise.resolve());
    HTMLElement.prototype.requestFullscreen = request;
    document.exitFullscreen = exit;
    player();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Tam ekran' }));
    expect(request).toHaveBeenCalledTimes(1);
    const frame = screen.getByRole('region', { name: 'Oynatıcı' });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: frame });
    fireEvent(document, new Event('fullscreenchange'));

    await user.click(screen.getByRole('button', { name: 'Tam ekrandan çık' }));
    expect(exit).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    fireEvent(document, new Event('fullscreenchange'));
    expect(screen.getByRole('button', { name: 'Tam ekran' })).toBeInTheDocument();
  });

  it('says it is loading until the video plays, and tells when it has played to the end', async () => {
    streaming();
    player({ subheading: 'S1:B2 · Fırtına' });

    expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor…');
    expect(screen.getByText('S1:B2 · Fırtına')).toBeInTheDocument();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    playAt(10);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.ended(video());
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('goes back to the title from its back link', async () => {
    streaming();
    player();

    expect(await screen.findByRole('link', { name: 'Geri dön' })).toHaveAttribute('href', '/tr/movies/c1');
  });
});
