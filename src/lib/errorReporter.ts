type RecentError = { at: string; scope: string; message: string };
const errors: RecentError[] = [];

export function reportError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  errors.push({ at: new Date().toISOString(), scope, message: message.slice(0, 300) });
  if (errors.length > 100) errors.shift();
  console.error(`[${scope}]`, error);
  const webhook = process.env.ERROR_REPORT_WEBHOOK_URL;
  if (webhook) {
    void fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope, message, at: new Date().toISOString() }) }).catch(() => {});
  }
}

export function getRecentErrors() {
  return errors.slice(-10).reverse();
}
