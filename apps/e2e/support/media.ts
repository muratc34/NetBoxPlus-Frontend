import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ffmpeg = process.env.FFMPEG_DIRECTORY ? join(process.env.FFMPEG_DIRECTORY, 'ffmpeg') : 'ffmpeg';

function run(args: string[]) {
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' });
}

export interface Media {
  readonly poster: string;
  readonly backdrop: string;
  readonly feature: string;
  readonly trailer: string;
  readonly dub: string;
  readonly subtitle: string;
}

/**
 * Made for the run with ffmpeg (FFMPEG_DIRECTORY or PATH), in `directory`: images at the sizes Catalog asks
 * for, a short feature with sound, a shorter trailer, a dub as long as the feature and a WebVTT subtitle.
 * Nothing is kept in the repository.
 */
export function makeMedia(directory: string): Media {
  mkdirSync(directory, { recursive: true });
  const file = (name: string) => join(directory, name);
  const media: Media = {
    poster: file('poster.png'),
    backdrop: file('backdrop.png'),
    feature: file('feature.mp4'),
    trailer: file('trailer.mp4'),
    dub: file('dub.wav'),
    subtitle: file('subtitle.vtt'),
  };
  run(['-f', 'lavfi', '-i', 'testsrc2=size=600x900', '-frames:v', '1', media.poster]);
  run(['-f', 'lavfi', '-i', 'testsrc2=size=1920x1080', '-frames:v', '1', media.backdrop]);
  const video = (seconds: number, output: string) => {
    run([
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=1280x720:rate=25:duration=${String(seconds)}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${String(seconds)}`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      output,
    ]);
  };
  video(8, media.feature);
  video(5, media.trailer);
  run(['-f', 'lavfi', '-i', 'sine=frequency=660:duration=8', media.dub]);
  writeFileSync(media.subtitle, 'WEBVTT\n\n00:00:00.500 --> 00:00:04.000\nUçtan uca altyazı.\n');
  return media;
}
