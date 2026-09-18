import type { HttpRequest } from './http-types.ts';

export class BadRequestError extends Error {}

export function readJson(req: HttpRequest): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(req.body || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestError('JSON object expected');
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError('invalid JSON body');
  }
}

export function readForm(req: HttpRequest): URLSearchParams {
  return new URLSearchParams(req.body);
}

export function str(source: Record<string, unknown>, key: string): string {
  const v = source[key];
  if (typeof v !== 'string') throw new BadRequestError(`${key} must be a string`);
  return v;
}

export function optStr(source: Record<string, unknown>, key: string): string | undefined {
  const v = source[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') throw new BadRequestError(`${key} must be a string`);
  return v;
}

export function strList(source: Record<string, unknown>, key: string): string[] {
  const v = source[key];
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new BadRequestError(`${key} must be a string array`);
  return v as string[];
}

export function numberRecord(source: Record<string, unknown>, key: string): Record<string, number> | undefined {
  const v = source[key];
  if (v === undefined) return undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadRequestError(`${key} must be an object`);
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (typeof n !== 'number') throw new BadRequestError(`${key}.${k} must be a number`);
    out[k] = n;
  }
  return out;
}

export function formValue(form: URLSearchParams, key: string): string {
  return form.get(key) ?? '';
}

/** Lines of "key: text" become rule entries (used by the HTML forms). */
export function parseRuleLines(text: string): { key: string; text: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const i = line.indexOf(':');
      return i < 0 ? { key: line, text: '' } : { key: line.slice(0, i).trim(), text: line.slice(i + 1).trim() };
    });
}

export function bearerToken(req: HttpRequest): string | undefined {
  const header = req.headers['authorization'];
  const m = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
  return m?.[1];
}
