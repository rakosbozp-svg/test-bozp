// Kódování automatické zálohy: otisk, komprese, base64, dělení na části a bezpečné segmenty cest v úložišti artefaktu.
// Jen standardní Web API (CompressionStream, crypto.subtle, btoa/atob) – běží v prohlížeči i v Node (testy).
export const MAX_CAST = 200000;   // znaků base64 na jednu část; dokument úložiště claude.ai má limit 256 KiB

const kodovac = new TextEncoder(), dekodovac = new TextDecoder();

// SHA-256 textu (UTF-8) jako 64 hex znaků.
export async function otisk(text) {
  const h = await crypto.subtle.digest('SHA-256', kodovac.encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const proud = async (bajty, transformace) => new Uint8Array(await new Response(new Blob([bajty]).stream().pipeThrough(transformace)).arrayBuffer());

// Po blocích, aby velké pole nepřeteklo zásobník při String.fromCharCode(...).
function naBase64(bajty) {
  let s = '';
  for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
}
function zBase64(data) {
  const s = atob(data), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

// Text → UTF-8 → gzip (když prohlížeč umí CompressionStream) → base64. velikost = bajty UTF-8 textu.
export async function zabal(text, { gzip = typeof CompressionStream !== 'undefined' } = {}) {
  const bajty = kodovac.encode(text);
  const vystup = gzip ? await proud(bajty, new CompressionStream('gzip')) : bajty;
  return { data: naBase64(vystup), komprese: gzip ? 'gzip' : 'zadna', velikost: bajty.length };
}

export async function rozbal({ data, komprese }) {
  const bajty = zBase64(data);
  if (komprese === 'gzip') return dekodovac.decode(await proud(bajty, new DecompressionStream('gzip')));
  if (komprese === 'zadna') return dekodovac.decode(bajty);
  throw new Error(`Neznámá komprese zálohy: ${komprese}`);
}

export function rozdel(data, n = MAX_CAST) {
  if (!data) return [''];
  const casti = [];
  for (let i = 0; i < data.length; i += n) casti.push(data.slice(i, i + n));
  return casti;
}

// Segment cesty v úložišti: beze změny jen písmena, číslice a _ - ~ : @; ostatní bajty UTF-8 (i „.“ a „+“) jako +xx.
// Převod je vratný a segment „.“ ani „..“ nikdy nevznikne.
const POVOLENE = /^[A-Za-z0-9_\-~:@]$/;
export function bezpecnySegment(id) {
  if (typeof id !== 'string' || !id) throw new Error('Prázdné id projektu');
  let s = '';
  for (const znak of id) {
    if (POVOLENE.test(znak)) s += znak;
    else for (const b of kodovac.encode(znak)) s += `+${b.toString(16).padStart(2, '0')}`;
  }
  return s;
}
export function zpetSegment(s) {
  const bajty = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '+') { bajty.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; } else bajty.push(s.charCodeAt(i));   // povolené znaky jsou ASCII
  }
  return dekodovac.decode(new Uint8Array(bajty));
}

// Náhodné id verze zálohy: 10 znaků [0-9a-z].
export function novaVerze() {
  return [...crypto.getRandomValues(new Uint8Array(10))].map((x) => (x % 36).toString(36)).join('');
}
