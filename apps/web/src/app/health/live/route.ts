// Liveness for the container platform: the server answers. The web app has nothing of its own to be ready for.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response('ok', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
