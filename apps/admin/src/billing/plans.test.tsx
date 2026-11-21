import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { PlanDetails, PlanSummary } from '../data/billing';
import { gatewayUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';
import { amountOf, priceOf } from './plan-page';

const billingUrl = `${gatewayUrl}/admin/billing`;
const writing = ['billing:plans:read', 'billing:plans:write'];

const premium: PlanDetails = {
  id: 'plan-premium',
  name: 'Premium',
  translations: {
    tr: { name: 'Premium', description: 'Dört ekranda HD.' },
    en: { name: 'Premium', description: 'HD on four screens.' },
  },
  amountMinor: 24999,
  currency: 'TRY',
  quality: 'Hd',
  maxScreens: 4,
  providerPriceId: 'price_premium',
  isActive: true,
  version: 3,
  createdAt: '2026-11-01T10:00:00Z',
  modifiedAt: null,
};

/** Billing's copy of the plan; a change the test makes is seen on the next read. */
function answerPlan(plan: PlanDetails = premium) {
  let current = plan;
  server.use(http.get(`${billingUrl}/plans/${plan.id}`, () => HttpResponse.json(current)));
  return (next: Partial<PlanDetails>) => {
    current = { ...current, ...next };
  };
}

const form = () => screen.getByRole('form', { name: 'Plan bilgileri' });
const field = (label: string) => within(form()).getByLabelText(label);

describe('prices', () => {
  it('reads a typed price in kuruş and writes kuruş back with the locale’s mark', () => {
    expect(amountOf('199,99')).toBe(19999);
    expect(amountOf('199.9')).toBe(19990);
    expect(amountOf(' 200 ')).toBe(20000);
    expect(amountOf('0,05')).toBe(5);
    expect(priceOf(24999, 'tr')).toBe('249,99');
    expect(priceOf(24990, 'en')).toBe('249.90');
  });
});

describe('PlansPage', () => {
  it('lists the plans with price, quality, screens and sale, filtered in the address', async () => {
    signInWith(writing);
    const asked: string[] = [];
    const plans: PlanSummary[] = [
      {
        id: 'p1',
        name: 'Premium',
        amountMinor: 24999,
        currency: 'TRY',
        quality: 'Hd',
        maxScreens: 4,
        isActive: true,
      },
      {
        id: 'p2',
        name: 'Eski',
        amountMinor: 9900,
        currency: 'TRY',
        quality: 'Sd',
        maxScreens: 1,
        isActive: false,
      },
    ];
    server.use(
      http.get(`${billingUrl}/plans`, ({ request }) => {
        const url = new URL(request.url);
        asked.push(url.search);
        return HttpResponse.json({ items: plans, pageNumber: 1, pageSize: 20, totalCount: 30 });
      }),
    );
    const { router } = renderApp('/plans');

    const table = await screen.findByRole('table');
    expect(document.title).toBe('Planlar');
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole('cell')
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      ['Premium', '₺249,99', 'HD (1080p)', '4', 'Satışta'],
      ['Eski', '₺99,00', 'SD (480p)', '1', 'Satışta değil'],
    ]);
    expect(screen.getByRole('link', { name: 'Premium' })).toHaveAttribute('href', '/plans/p1');
    expect(screen.getByRole('link', { name: 'Yeni plan' })).toHaveAttribute('href', '/plans/new');
    expect(asked).toEqual(['?page=1&pageSize=20']);

    await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/plans?page=2');
    });
    await userEvent.selectOptions(screen.getByLabelText('Satış'), 'Satışta değil');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/plans?sale=offSale');
    });
    expect(screen.getByLabelText('Satış')).toHaveValue('offSale');
    await userEvent.selectOptions(screen.getByLabelText('Satış'), 'Satışta');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/plans?sale=onSale');
    });
    await userEvent.selectOptions(screen.getByLabelText('Satış'), 'Hepsi');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/plans');
    });
    expect(asked).toEqual([
      '?page=1&pageSize=20',
      '?page=2&pageSize=20',
      '?active=false&page=1&pageSize=20',
      '?active=true&page=1&pageSize=20',
      '?page=1&pageSize=20',
    ]);
  });

  it('says when there is no plan, and offers no new plan without the write permission', async () => {
    signInWith(['billing:plans:read']);
    server.use(
      http.get(`${billingUrl}/plans`, () =>
        HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
      ),
    );
    renderApp('/plans?sale=bogus');

    expect(await screen.findByText('Plan bulunamadı.')).toBeInTheDocument();
    expect(screen.getByLabelText('Satış')).toHaveValue('');
    expect(screen.queryByRole('link', { name: 'Yeni plan' })).not.toBeInTheDocument();
  });

  it('shows a failure to read the plans', async () => {
    signInWith(['billing:plans:read']);
    server.use(http.get(`${billingUrl}/plans`, () => problem(403, 'Error.Forbidden')));
    renderApp('/plans');

    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
  });
});

describe('PlanPage', () => {
  it('shows the plan and saves the changes at the version it works from', async () => {
    signInWith(writing);
    const change = answerPlan();
    const sent: unknown[] = [];
    server.use(
      http.put(`${billingUrl}/plans/${premium.id}`, async ({ request }) => {
        sent.push(await request.json());
        change({ name: 'Premium Plus', version: premium.version + 1 });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/plans/${premium.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Premium' });
    expect(document.title).toBe('Premium');
    expect(screen.getByText('Satışta', { selector: 'span' })).toBeInTheDocument();
    expect(field('Türkçe ad')).toHaveValue('Premium');
    expect(field('Türkçe ad')).toHaveAttribute('lang', 'tr');
    expect(field('İngilizce açıklama')).toHaveValue('HD on four screens.');
    expect(field('İngilizce açıklama')).toHaveAttribute('lang', 'en');
    expect(field('Aylık fiyat (TRY)')).toHaveValue('249,99');
    expect(field('Aylık fiyat (TRY)')).toHaveAccessibleDescription(/Stripe’taki fiyatla aynı olmalı/);
    expect(field('Stripe fiyat kimliği')).toHaveValue('price_premium');
    expect(field('Görüntü kalitesi')).toHaveValue('Hd');
    expect(field('Ekran sayısı')).toHaveValue(4);

    await userEvent.clear(field('Türkçe ad'));
    await userEvent.type(field('Türkçe ad'), ' Premium Plus ');
    await userEvent.clear(field('İngilizce ad'));
    await userEvent.clear(field('İngilizce açıklama'));
    await userEvent.clear(field('Türkçe açıklama'));
    await userEvent.clear(field('Aylık fiyat (TRY)'));
    await userEvent.type(field('Aylık fiyat (TRY)'), '299.5');
    await userEvent.selectOptions(field('Görüntü kalitesi'), 'Ultra HD');
    await userEvent.clear(field('Ekran sayısı'));
    await userEvent.type(field('Ekran sayısı'), '10');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    expect(await within(form()).findByRole('status')).toHaveTextContent('Kaydedildi.');
    expect(sent[0]).toEqual({
      translations: { tr: { name: 'Premium Plus', description: null } },
      amountMinor: 29950,
      currency: 'TRY',
      quality: 'Uhd',
      maxScreens: 10,
      providerPriceId: 'price_premium',
      version: 3,
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Premium Plus' })).toBeInTheDocument();

    // The next save goes from the version the first one made.
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(sent).toHaveLength(2);
    });
    expect(sent[1]).toMatchObject({ version: 4 });

    // Saved changes are no reason to ask before leaving.
    await userEvent.click(screen.getByRole('link', { name: 'Planlar' }));
    await screen.findByRole('heading', { level: 1, name: 'Planlar' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('checks the fields before sending', async () => {
    signInWith(writing);
    let sent = false;
    server.use(
      http.post(`${billingUrl}/plans`, () => {
        sent = true;
        return HttpResponse.json({ id: 'x' }, { status: 201 });
      }),
    );
    renderApp('/plans/new');

    await screen.findByRole('heading', { level: 1, name: 'Yeni plan' });
    expect(document.title).toBe('Yeni plan');
    expect(field('Görüntü kalitesi')).toHaveValue('Hd');
    expect(field('Ekran sayısı')).toHaveValue(1);
    await userEvent.type(field('İngilizce açıklama'), 'Only in English.');
    await userEvent.type(field('Aylık fiyat (TRY)'), '12,345');
    await userEvent.clear(field('Ekran sayısı'));
    await userEvent.type(field('Ekran sayısı'), '11');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    expect(
      await within(form()).findByText('Fiyatı en fazla iki ondalıkla yaz (199,99).'),
    ).toBeInTheDocument();
    expect(field('Türkçe ad')).toHaveAccessibleDescription('Bu alan zorunlu.');
    expect(field('İngilizce ad')).toHaveAccessibleDescription('Ad zorunlu.');
    expect(field('Ekran sayısı')).toHaveAccessibleDescription('Ekran sayısı 1 ile 10 arasında olmalı.');
    expect(field('Stripe fiyat kimliği')).toHaveAccessibleDescription('Bu alan zorunlu.');

    await userEvent.clear(field('Aylık fiyat (TRY)'));
    await userEvent.type(field('Aylık fiyat (TRY)'), '0,00');
    await userEvent.clear(field('Ekran sayısı'));
    await userEvent.type(field('Ekran sayısı'), '0');
    await userEvent.click(field('Türkçe ad'));
    await userEvent.paste('x'.repeat(65));
    await userEvent.click(field('Stripe fiyat kimliği'));
    await userEvent.paste('p'.repeat(129));
    await userEvent.click(field('Türkçe açıklama'));
    await userEvent.paste('d'.repeat(501));
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await within(form()).findByText('Fiyat sıfırdan büyük olmalı.')).toBeInTheDocument();
    expect(field('Ekran sayısı')).toHaveAccessibleDescription('Ekran sayısı 1 ile 10 arasında olmalı.');
    expect(field('Türkçe ad')).toHaveAccessibleDescription('Ad en fazla 64 karakter olabilir.');
    expect(field('Türkçe açıklama')).toHaveAccessibleDescription('Açıklama en fazla 500 karakter olabilir.');
    expect(field('Stripe fiyat kimliği')).toHaveAccessibleDescription(
      'Stripe fiyat kimliği zorunlu (en fazla 128 karakter).',
    );
    expect(sent).toBe(false);
  });

  it('makes a plan off sale and goes on to its page', async () => {
    signInWith(writing);
    answerPlan({ ...premium, id: 'plan-new', name: 'Temel', isActive: false, version: 1 });
    let body: unknown;
    server.use(
      http.post(`${billingUrl}/plans`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'plan-new' }, { status: 201 });
      }),
    );
    const { router } = renderApp('/plans/new');

    await screen.findByRole('heading', { level: 1, name: 'Yeni plan' });
    expect(screen.queryByRole('region', { name: 'Satış' })).not.toBeInTheDocument();
    await userEvent.type(field('Türkçe ad'), 'Temel');
    await userEvent.type(field('Türkçe açıklama'), 'Tek ekran.');
    await userEvent.type(field('İngilizce ad'), 'Basic');
    await userEvent.type(field('Aylık fiyat (TRY)'), '99');
    await userEvent.selectOptions(field('Görüntü kalitesi'), 'SD (480p)');
    await userEvent.type(field('Stripe fiyat kimliği'), ' price_basic ');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => {
      expect(locationOf(router)).toBe('/plans/plan-new');
    });
    expect(body).toEqual({
      translations: {
        tr: { name: 'Temel', description: 'Tek ekran.' },
        en: { name: 'Basic', description: null },
      },
      amountMinor: 9900,
      currency: 'TRY',
      quality: 'Sd',
      maxScreens: 1,
      providerPriceId: 'price_basic',
      version: 0,
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Temel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Satış' })).toHaveTextContent('Plan satışta değil');
  });

  it('puts a refusal on its field or on the form', async () => {
    signInWith(writing);
    answerPlan();
    let answer = () => problem(409, 'Plan.ProviderPriceTaken');
    server.use(http.put(`${billingUrl}/plans/${premium.id}`, () => answer()));
    renderApp(`/plans/${premium.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Premium' });
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(
      await within(form()).findByText('Bu Stripe fiyatını başka bir plan kullanıyor.'),
    ).toBeInTheDocument();
    expect(field('Stripe fiyat kimliği')).toHaveAccessibleDescription(
      'Bu Stripe fiyatını başka bir plan kullanıyor.',
    );

    for (const [code, label, text] of [
      ['Plan.AmountInvalid', 'Aylık fiyat (TRY)', 'Fiyat sıfırdan büyük olmalı.'],
      ['Plan.ScreensInvalid', 'Ekran sayısı', 'Ekran sayısı 1 ile 10 arasında olmalı.'],
      ['Plan.QualityInvalid', 'Görüntü kalitesi', 'Geçerli bir kalite seç.'],
      ['Plan.NameRequired', 'Türkçe ad', 'Ad zorunlu.'],
      ['Plan.NameTooLong', 'Türkçe ad', 'Ad en fazla 64 karakter olabilir.'],
      ['Plan.DescriptionTooLong', 'Türkçe açıklama', 'Açıklama en fazla 500 karakter olabilir.'],
      [
        'Plan.ProviderPriceRequired',
        'Stripe fiyat kimliği',
        'Stripe fiyat kimliği zorunlu (en fazla 128 karakter).',
      ],
    ] as const) {
      answer = () => problem(400, code);
      await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
      await waitFor(() => {
        expect(field(label)).toHaveAccessibleDescription(text);
      });
    }

    answer = () => problem(400, 'Plan.CurrencyUnsupported');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await within(form()).findByRole('alert')).toHaveTextContent('Bu para birimi desteklenmiyor.');
  });

  it('keeps the changes after a conflict and loads the current plan when asked', async () => {
    signInWith(writing);
    const change = answerPlan();
    server.use(http.put(`${billingUrl}/plans/${premium.id}`, () => problem(409, 'Plan.VersionConflict')));
    renderApp(`/plans/${premium.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Premium' });
    await userEvent.clear(field('Türkçe ad'));
    await userEvent.type(field('Türkçe ad'), 'Benim değişikliğim');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('başka biri değiştirdi');
    expect(field('Türkçe ad')).toHaveValue('Benim değişikliğim');

    change({ name: 'Onların', translations: { tr: { name: 'Onların', description: null } }, version: 7 });
    await userEvent.click(within(notice).getByRole('button', { name: 'Güncel hâli yükle' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Onların' })).toBeInTheDocument();
    expect(field('Türkçe ad')).toHaveValue('Onların');
    expect(field('İngilizce ad')).toHaveValue('');
    expect(screen.queryByText(/başka biri değiştirdi/)).not.toBeInTheDocument();
  });

  it('takes the plan off sale after asking and puts it back, moving the version on', async () => {
    signInWith(writing);
    const change = answerPlan();
    const sent: string[] = [];
    let saved: unknown;
    let answer = () => problem(404, 'Plan.NotFound');
    server.use(
      http.post(`${billingUrl}/plans/${premium.id}/:action`, ({ params }) => {
        sent.push(String(params.action));
        return answer();
      }),
      http.put(`${billingUrl}/plans/${premium.id}`, async ({ request }) => {
        saved = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/plans/${premium.id}`);

    const sale = await screen.findByRole('region', { name: 'Satış' });
    expect(sale).toHaveTextContent('Plan satışta: müşteriler bu planla abonelik başlatabilir.');
    await userEvent.click(within(sale).getByRole('button', { name: 'Satıştan kaldır' }));
    let dialog = screen.getByRole('dialog', { name: '“Premium” satıştan kaldırılsın mı?' });
    expect(dialog).toHaveTextContent('mevcut aboneler aboneliklerini korur');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Satıştan kaldır' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/./);
    expect(
      within(screen.getByRole('region', { name: 'Satış', hidden: true })).queryAllByRole('alert', {
        hidden: true,
      }),
    ).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(within(sale).queryByRole('alert')).not.toBeInTheDocument();

    answer = () => {
      change({ isActive: false, version: premium.version + 1 });
      return new HttpResponse(null, { status: 204 });
    };
    await userEvent.click(within(sale).getByRole('button', { name: 'Satıştan kaldır' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Satıştan kaldır' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await within(sale).findByText(/Plan satışta değil/)).toBeInTheDocument();
    expect(screen.getByText('Satışta değil', { selector: 'span' })).toBeInTheDocument();

    answer = () => problem(404, 'Plan.NotFound');
    await userEvent.click(within(sale).getByRole('button', { name: 'Satışa aç' }));
    expect(await within(sale).findByRole('alert')).toHaveTextContent(/./);

    answer = () => {
      change({ isActive: true, version: premium.version + 2 });
      return new HttpResponse(null, { status: 204 });
    };
    await userEvent.click(within(sale).getByRole('button', { name: 'Satışa aç' }));
    expect(await within(sale).findByRole('button', { name: 'Satıştan kaldır' })).toBeInTheDocument();
    expect(sent).toEqual(['deactivate', 'deactivate', 'activate', 'activate']);

    // Its own sale changes moved the plan on twice.
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(saved).toMatchObject({ version: premium.version + 2 });
    });
  });

  it('only shows the plan without the write permission', async () => {
    signInWith(['billing:plans:read']);
    answerPlan();
    renderApp(`/plans/${premium.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Premium' });
    expect(field('Türkçe ad')).toBeDisabled();
    expect(within(form()).queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Satış' })).not.toBeInTheDocument();
  });

  it('keeps making a plan to the write permission and says when a plan is gone', async () => {
    signInWith(['billing:plans:read']);
    server.use(http.get(`${billingUrl}/plans/gone`, () => problem(404, 'Plan.NotFound')));
    const first = renderApp('/plans/new');
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu sayfa için yetkin yok.');
    first.unmount();

    renderApp('/plans/gone');
    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});
