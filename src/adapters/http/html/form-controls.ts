import { esc } from './escape.ts';

/** Wraps one control with its visible label, so every input is named without relying on placeholders. */
export function field(label: string, control: string, hint?: string): string {
  return `<label class="field"><span class="field-label">${esc(label)}</span>${control}${hint ? `<span class="field-hint muted">${esc(hint)}</span>` : ''}</label>`;
}

export function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`;
}

export function option(value: string, label: string, selected = false): string {
  return `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
}

export function submit(label: string): string {
  return `<button type="submit" class="primary">${esc(label)}</button>`;
}
