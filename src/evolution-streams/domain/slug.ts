import { fail, ok, type Result } from '../../shared/result.ts';

/**
 * Slugs become single git ref path segments (evolution/<tide>/<variant>),
 * so they must not contain '/', spaces, '..' or ref-illegal characters.
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function validateSlug(kind: string, slug: string): Result<string> {
  if (!SLUG_PATTERN.test(slug)) {
    return fail('invalid_slug', `${kind} の識別名は英小文字・数字・ハイフン (先頭は英数字、40 文字以内) で指定してください`);
  }
  if (slug === 'main') {
    // 'main' is reserved for the mainline segment of the suffix naming style.
    return fail('reserved_slug', `${kind} の識別名に main は使えません`);
  }
  return ok(slug);
}
