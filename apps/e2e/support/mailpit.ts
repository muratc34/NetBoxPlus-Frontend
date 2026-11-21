import { expect } from '@playwright/test';
import { urls } from './environment';

interface MessageSummary {
  readonly ID: string;
  readonly Subject: string;
  readonly Created: string;
}

/** The newest e-mail to `address` whose subject matches, waited for (Notification sends from a queue). */
export async function waitForEmail(address: string, subject: RegExp, after = new Date(0)): Promise<string> {
  let found: MessageSummary | undefined;
  await expect
    .poll(
      async () => {
        const query = new URLSearchParams({ query: `to:"${address}"` });
        const response = await fetch(`${urls.mailpit}/api/v1/search?${query.toString()}`);
        const body = (await response.json()) as { messages: MessageSummary[] };
        found = body.messages.find(
          (message) => subject.test(message.Subject) && new Date(message.Created) >= after,
        );
        return found !== undefined;
      },
      { message: `an e-mail to ${address} matching ${String(subject)}`, timeout: 60_000, intervals: [1000] },
    )
    .toBe(true);
  const response = await fetch(`${urls.mailpit}/api/v1/message/${found?.ID ?? ''}`);
  const message = (await response.json()) as { Text: string; HTML: string };
  return `${message.Text}\n${message.HTML}`;
}

/** The first link in an e-mail that goes to `path` on the web app. */
export function linkTo(body: string, path: string): string {
  const pattern = new RegExp(`https?://[^\\s"'<>]+${path.replace(/[/]/g, '\\/')}[^\\s"'<>]*`);
  const link = pattern.exec(body)?.[0];
  if (!link) {
    throw new Error(`No link to ${path} in the e-mail.`);
  }
  return link.replaceAll('&amp;', '&');
}
