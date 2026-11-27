import { loadBackendEnvironment, urls } from './environment';

/** Before the screenshots: the backend's environment read and the system checked to be up. */
export default async function screenshotsSetup(): Promise<void> {
  loadBackendEnvironment();
  for (const [name, url] of [
    ['gateway', `${urls.gateway}/health/ready`],
    ['admin panel', urls.admin],
  ] as const) {
    const response = await fetch(url).catch(() => undefined);
    if (!response?.ok) {
      throw new Error(`The ${name} is not answering at ${url}.`);
    }
  }
}
