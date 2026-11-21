import { spawn, type ChildProcess } from 'node:child_process';
import { stripeTestKey, urls } from './environment';

const api = 'https://api.stripe.com/v1';

/** The events Billing handles; the Stripe CLI forwards only what it is told to (as `dev.ps1` does). */
const events = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.finalized',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.voided',
  'invoice.marked_uncollectible',
].join(',');

async function stripe<T>(method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<T> {
  const response = await fetch(`${api}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${stripeTestKey()}` },
    ...(form ? { body: new URLSearchParams(form) } : {}),
  });
  const body = (await response.json()) as T & { error?: { message: string } };
  if (!response.ok) {
    throw new Error(
      `Stripe ${method} ${path.split('?')[0] ?? ''} answered ${String(response.status)}: ${body.error?.message ?? ''}`,
    );
  }
  return body;
}

/**
 * What a paid checkout leaves behind, done through Stripe's API instead of its hosted page: the card on the
 * customer Billing made for the checkout, and a subscription tagged with the user and plan the way
 * Billing's checkout tags it. Billing learns of it through the webhook.
 */
export async function payForPlan(
  email: string,
  userId: string,
  planId: string,
  lookupKey: string,
): Promise<void> {
  const customers = await stripe<{ data: { id: string }[] }>(
    'GET',
    `customers?${new URLSearchParams({ email, limit: '1' }).toString()}`,
  );
  const customer =
    customers.data[0]?.id ??
    (await stripe<{ id: string }>('POST', 'customers', { email, 'metadata[userId]': userId })).id;
  const method = await stripe<{ id: string }>('POST', 'payment_methods/pm_card_visa/attach', { customer });
  await stripe('POST', `customers/${customer}`, { 'invoice_settings[default_payment_method]': method.id });
  const prices = await stripe<{ data: { id: string }[] }>(
    'GET',
    `prices?${new URLSearchParams({ 'lookup_keys[]': lookupKey, active: 'true' }).toString()}`,
  );
  const price = prices.data[0]?.id;
  if (!price) {
    throw new Error(`The Stripe price ${lookupKey} is missing: run ./deploy/dev.ps1 seed with a Stripe key.`);
  }
  await stripe('POST', 'subscriptions', {
    customer,
    'items[0][price]': price,
    'metadata[userId]': userId,
    'metadata[planId]': planId,
  });
}

/**
 * The Stripe CLI forwarding Billing's events to the gateway for the run. The key goes in its environment,
 * not on its command line.
 */
export async function startWebhookForwarding(): Promise<ChildProcess> {
  const listener = spawn(
    'stripe',
    ['listen', '--events', events, '--forward-to', `${urls.gateway}/billing/webhooks/stripe`],
    {
      env: { ...process.env, STRIPE_API_KEY: stripeTestKey() },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('stripe listen did not get ready in 30 seconds. Is the Stripe CLI installed?'));
    }, 30_000);
    const ready = (chunk: Buffer) => {
      if (chunk.toString().includes('Ready!')) {
        clearTimeout(timer);
        resolve();
      }
    };
    listener.stdout.on('data', ready);
    listener.stderr.on('data', ready);
    listener.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return listener;
}
