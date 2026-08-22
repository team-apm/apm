import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNicommonsData } from './nicommons';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('electron', () => ({ net: { fetch: mocks.fetch } }));
vi.mock('electron-log/main', () => ({
  default: { error: vi.fn(), debug: vi.fn() },
}));

describe('getNicommonsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('works エンドポイントに ID を渡して data を返す', async () => {
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ data: { node: { thumbnailURL: 'x' } } }),
    });

    expect(await getNicommonsData('sm123')).toEqual({
      node: { thumbnailURL: 'x' },
    });
    expect(mocks.fetch.mock.calls[0][0]).toBe(
      'https://public-api.commons.nicovideo.jp/v1/works/sm123?with_meta=1',
    );
  });

  it('URL の構文になる文字を含む ID でも works エンドポイントから外れない', async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 404 });

    await getNicommonsData('../../v1/other?x=1');

    const url = new URL(mocks.fetch.mock.calls[0][0] as string);
    expect(url.pathname.startsWith('/v1/works/')).toBe(true);
    expect(url.searchParams.get('with_meta')).toBe('1');
    expect(url.searchParams.get('x')).toBeNull();
  });

  it('404 は false', async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 404 });
    expect(await getNicommonsData('sm404')).toBe(false);
  });

  it('取得に失敗しても false に畳む', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('offline'));
    expect(await getNicommonsData('sm1')).toBe(false);
  });
});
