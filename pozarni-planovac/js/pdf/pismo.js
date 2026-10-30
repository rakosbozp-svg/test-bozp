// Znaky, které vložené písmo (Roboto) nemá, by se v PDF vykreslily jako prázdný čtvereček. Před měřením a kreslením
// se nahradí čitelnou náhradou (→ „->“, CO₂ → CO2); neznámý znak bez náhrady se nahradí „?“, aby nikdy nezmizel beze stopy.
const NAHRADY = { '→': '->', '←': '<-', '⇒': '=>', '↔': '<->', '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '⁰': '0', '¹': '1', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '−': '-', '‑': '-', '✓': 'ano', '✔': 'ano', '✗': 'ne', '•': '·', '\t': ' ', ' ': ' ', ' ': ' ', ' ': ' ' };
const sady = new WeakMap();
const sada = (font) => { let s = sady.get(font); if (!s) { s = new Set(font.getCharacterSet?.() || []); sady.set(font, s); } return s; };

export function bezpecnyText(t, font) {
  const s = sada(font); if (!s.size) return String(t ?? '');
  let o = '';
  for (const ch of String(t ?? '')) {
    const cp = ch.codePointAt(0);
    if (ch === '\n' || s.has(cp)) { o += ch; continue; }
    const n = NAHRADY[ch];
    o += n !== undefined && [...n].every((x) => s.has(x.codePointAt(0)) || x === ' ') ? n : (cp < 32 ? ' ' : '?');
  }
  return o;
}
