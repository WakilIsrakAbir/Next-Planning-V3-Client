import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { harnessState } from '../harness/state';

// The page shows dates in local time: every recording is made in the users' time zone (UTC+6, no DST).
if (new Date('2026-01-01T00:00:00Z').getTimezoneOffset() !== -360) {
  throw new Error(`Tests must run with TZ=Asia/Dhaka (got offset ${new Date().getTimezoneOffset()}).`);
}
if (process.env.NEXT_PUBLIC_API_URL !== 'http://api.test') {
  throw new Error('Tests must run with NEXT_PUBLIC_API_URL=http://api.test (see vitest.config.ts).');
}

// No real network, ever: a scenario installs the mocked server; anything else fails the test.
globalThis.fetch = (async (input: unknown, init?: unknown) => {
  const handler = harnessState().fetchHandler;
  if (!handler) throw new Error(`Unmocked fetch: ${String(input)}`);
  return handler(input, init);
}) as typeof fetch;

// next/navigation: the route params and router of the running scenario (one stable router object, as in Next).
vi.mock('next/navigation', () => ({
  useParams: () => harnessState().params,
  useRouter: () => harnessState().router,
  usePathname: () => harnessState().pathname,
  useSearchParams: () => new URLSearchParams(),
}));

// next/link renders the "Order Not Found" link only; a plain anchor keeps the harness free of router internals.
vi.mock('next/link', async () => {
  const React = await import('react');
  type LinkProps = { href: string; children?: unknown; className?: string };
  function Link({ href, children, className }: LinkProps) {
    return React.createElement('a', { href, className, 'data-next-link': 'true' }, children as never);
  }
  return { default: Link };
});

afterEach(() => {
  cleanup();
});
