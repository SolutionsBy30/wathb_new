import { PaymobProvider } from './paymob-provider';

// Paymob credentials are scoped to a single regional instance, so which host
// the provider talks to is a correctness concern, not a cosmetic one — a
// Saudi key against the Egyptian host fails with a 401 that reads like a
// missing key. These lock the host in for both URLs the provider builds.
function configWith(values: Record<string, string>) {
  return {
    getOrThrow: (key: string) => {
      const v = values[key];
      if (!v) throw new Error(`missing ${key}`);
      return v;
    },
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as any;
}

const CREDENTIALS = {
  PAYMOB_SECRET_KEY: 'sk_test_123',
  PAYMOB_PUBLIC_KEY: 'pk_test_456',
  PAYMOB_INTEGRATION_ID: '99887766',
};

const CHECKOUT_PARAMS = {
  amountHalalas: 4500,
  currency: 'SAR',
  merchantOrderId: 'sub-1',
  customerName: 'طالب تجريبي',
  customerMobile: '+966500000001',
  successRedirectUrl: 'https://wathb.tech/#subscription=success',
};

function mockFetchOnce() {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 42, client_secret: 'cs_abc' }),
  });
  (global as any).fetch = fetchMock;
  return fetchMock;
}

describe('PaymobProvider regional host', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to the KSA instance for both the intention call and the checkout URL', async () => {
    const fetchMock = mockFetchOnce();
    const provider = new PaymobProvider(configWith({ ...CREDENTIALS }));

    const result = await provider.createCheckout(CHECKOUT_PARAMS);

    expect(fetchMock).toHaveBeenCalledWith('https://ksa.paymob.com/v1/intention/', expect.anything());
    expect(result.checkoutUrl.startsWith('https://ksa.paymob.com/unifiedcheckout/')).toBe(true);
  });

  it('honours PAYMOB_BASE_URL for a non-Saudi market', async () => {
    const fetchMock = mockFetchOnce();
    const provider = new PaymobProvider(
      configWith({ ...CREDENTIALS, PAYMOB_BASE_URL: 'https://accept.paymob.com' }),
    );

    const result = await provider.createCheckout(CHECKOUT_PARAMS);

    expect(fetchMock).toHaveBeenCalledWith('https://accept.paymob.com/v1/intention/', expect.anything());
    expect(result.checkoutUrl.startsWith('https://accept.paymob.com/unifiedcheckout/')).toBe(true);
  });

  it('strips a trailing slash so the built URLs never double up', async () => {
    const fetchMock = mockFetchOnce();
    const provider = new PaymobProvider(
      configWith({ ...CREDENTIALS, PAYMOB_BASE_URL: 'https://ksa.paymob.com/' }),
    );

    await provider.createCheckout(CHECKOUT_PARAMS);

    expect(fetchMock).toHaveBeenCalledWith('https://ksa.paymob.com/v1/intention/', expect.anything());
  });
});
