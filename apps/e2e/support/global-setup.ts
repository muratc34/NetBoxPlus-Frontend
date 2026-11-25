import { loadBackendEnvironment, urls } from './environment';
import { checkWebhookSecret, startWebhookForwarding } from './stripe';

/**
 * Before the run: the backend's environment read, the system checked to be up, and Stripe's webhook
 * forwarded for the run's subscriptions. Returns what to undo after it.
 */
export default async function globalSetup(): Promise<() => void> {
  loadBackendEnvironment();
  for (const [name, url] of [
    ['gateway', `${urls.gateway}/health/ready`],
    ['Mailpit', `${urls.mailpit}/api/v1/info`],
  ] as const) {
    const response = await fetch(url).catch(() => undefined);
    if (!response?.ok) {
      throw new Error(
        `${name} is not answering at ${url}. Start the system: ./deploy/dev.ps1 up -App, then seed.`,
      );
    }
  }
  checkWebhookSecret();
  const listener = await startWebhookForwarding();
  return () => {
    listener.kill();
  };
}
