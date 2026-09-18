/**
 * Minimal JSON HTTP client for Cc. It only classifies transport results; meaning is
 * decided by each gateway. Connection failures are `not_connected` (nothing delivered),
 * timeouts are `unknown` (may have been delivered).
 */
export type HttpOutcome =
  | { readonly kind: 'response'; readonly status: number; readonly body: unknown }
  | { readonly kind: 'not_connected'; readonly reason: string }
  | { readonly kind: 'unknown'; readonly reason: string };

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal }) => Promise<{
  readonly status: number;
  text(): Promise<string>;
}>;

/** Errors raised before a connection exists, so the request cannot have been delivered. */
const CONNECTION_ERRORS = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN']);

function errorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown } } | undefined)?.cause;
  const code = cause?.code ?? (error as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

export class CcHttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: { readonly baseUrl: string; readonly fetchImpl: FetchLike; readonly timeoutMs: number }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl;
    this.timeoutMs = options.timeoutMs;
  }

  async request(method: 'GET' | 'POST', path: string, body?: unknown, headers: Record<string, string> = {}): Promise<HttpOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json; charset=utf-8' } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const text = await response.text();
      let parsed: unknown = undefined;
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text; // Non-JSON error pages are passed through as text for the detail message.
        }
      }
      return { kind: 'response', status: response.status, body: parsed };
    } catch (error) {
      if (controller.signal.aborted) return { kind: 'unknown', reason: `Cc 応答タイムアウト (${this.timeoutMs}ms)` };
      const code = errorCode(error);
      if (code && CONNECTION_ERRORS.has(code)) return { kind: 'not_connected', reason: `Cc に接続できません (${code})` };
      return { kind: 'unknown', reason: `Cc 通信エラー (${code ?? 'unclassified'})` };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function detailOf(body: unknown): string {
  if (typeof body === 'string') return body.slice(0, 200);
  if (body && typeof body === 'object') {
    const b = body as { error?: unknown; message?: unknown };
    const text = typeof b.error === 'string' ? b.error : typeof b.message === 'string' ? b.message : undefined;
    if (text) return text.slice(0, 200);
  }
  return 'no detail';
}
