/** Equivalente ao `slugify` do Django (sem acentos, minusculo, hifens), cortado no tamanho da coluna. */
export function slugify(value: string, maxLength = 50): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** Primeira letra de cada palavra em maiuscula (como `str.title()` do Python). */
export function titleCase(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR').replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase('pt-BR'));
}

export function cleanUrl(value: unknown, maxLength = 500): string {
  const url = typeof value === 'string' ? value.trim() : '';
  return /^https?:\/\//i.test(url) && url.length <= maxLength ? url : '';
}

const ICON_HINTS = /(^|[/_.-])(logo|icon|favicon|sprite|disambig|placeholder|blank|pixel)([/_.-]|$)/i;

/** URL de imagem que serve como foto: descarta svg, miniaturas da Wikimedia (< 200px) e logos/icones. */
export function cleanImageUrl(value: unknown, maxLength = 500): string {
  const url = cleanUrl(value, maxLength);
  if (!url) return '';
  const path = url.split(/[?#]/)[0];
  if (/\.svg$/i.test(path) || /\.svg\//i.test(path)) return '';
  const thumbWidth = /\/(\d+)px-[^/]+$/.exec(path);
  if (thumbWidth && Number(thumbWidth[1]) < 200) return '';
  return ICON_HINTS.test(path) ? '' : url;
}
