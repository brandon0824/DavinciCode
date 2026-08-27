import { describe, expect, it, vi } from 'vitest';
import { getRecentErrors, reportError } from './errorReporter';

describe('error reporter', () => {
  it('keeps a bounded, readable recent error list', () => {
    reportError('test', new Error('expected failure'));
    const latest = getRecentErrors()[0];
    expect(latest.scope).toBe('test');
    expect(latest.message).toContain('expected failure');
    expect(latest.at).toBeTruthy();
  });

  it('forwards errors to the configured webhook', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    process.env.ERROR_REPORT_WEBHOOK_URL = 'https://monitoring.invalid/events';
    reportError('webhook-test', new Error('forward me'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledWith('https://monitoring.invalid/events', expect.objectContaining({ method: 'POST' }));
    delete process.env.ERROR_REPORT_WEBHOOK_URL;
    vi.unstubAllGlobals();
  });
});
