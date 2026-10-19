// Dekódování textů z CAD (DXF TEXT / MTEXT): formátovací kódy MTEXT, zalomení řádků, Unicode a AutoCAD kódy (%%c, \U+XXXX),
// XML entity. Výsledek je prostý text pro upravitelný textový prvek.

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
export function dekodujXmlEntity(t) {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return ENTITY[e.toLowerCase()] ?? m;
  });
}

// %%c Ø, %%d °, %%p ±, %%% %, %%nnn znak s kódem nnn; %%u %%o %%k jsou přepínače podtržení/nadtržení – zahodí se.
export function dekodujAutocadKody(t) {
  return t
    .replace(/%%([cC])/g, 'Ø').replace(/%%([dD])/g, '°').replace(/%%([pP])/g, '±').replace(/%%%/g, '%')
    .replace(/%%([uUoOkK])/g, '')
    .replace(/%%(\d{3})/g, (m, n) => String.fromCharCode(parseInt(n, 10)));
}

// Hlavní funkce: MTEXT (s formátováním) → prostý text s \n.
export function dekodujMtext(raw) {
  let t = String(raw ?? '');
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\\') {
      const n = t[i + 1];
      if (n === undefined) break;
      if (n === 'P') { out += '\n'; i += 1; continue; }
      if (n === '~') { out += '\u00a0'; i += 1; continue; }
      if (n === '\\' || n === '{' || n === '}') { out += n; i += 1; continue; }
      if (n === 'N') { i += 1; continue; }                                    // nový sloupec – ignorovat
      if ('LlOoKk'.includes(n)) { i += 1; continue; }                        // podtržení / nadtržení / přeškrtnutí
      if ('fFHWQTACcpa'.includes(n) || n === 'p') {                           // parametry do středníku (písmo, výška, šířka, zešikmení, sledování, zarovnání, barva, odstavec)
        const e = t.indexOf(';', i + 2); i = e < 0 ? t.length : e; continue;
      }
      if (n === 'S') {                                                        // zlomek \S1/2;  \S1^2;  \S1#2;
        const e = t.indexOf(';', i + 2), s = t.slice(i + 2, e < 0 ? t.length : e);
        out += s.replace(/[\^#]/g, '/'); i = e < 0 ? t.length : e; continue;
      }
      if (n === 'U' && t[i + 2] === '+') {                                    // \U+0161
        const h = /^[0-9a-fA-F]{4}/.exec(t.slice(i + 3));
        if (h) { out += String.fromCodePoint(parseInt(h[0], 16)); i += 2 + h[0].length; continue; }
      }
      if (n === 'M' && t[i + 2] === '+') { const h = /^[0-9a-fA-F]{5}/.exec(t.slice(i + 4)); i += h ? 3 + h[0].length : 2; continue; }   // starší vícebajtové kódy – nepodporováno, vynechá se
      out += n; i += 1; continue;                                             // neznámá escape sekvence: ponechat znak
    }
    if (c === '{' || c === '}') continue;                                     // skupiny formátování
    if (c === '^' && t[i + 1] !== undefined && /[A-Z@\[\]\\^_]/.test(t[i + 1])) { const k = t[i + 1]; out += k === 'I' ? ' ' : k === 'J' ? '\n' : ''; i += 1; continue; }   // řídicí znaky ^I ^J ^M
    out += c;
  }
  out = dekodujAutocadKody(dekodujXmlEntity(out));
  return out.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Jednoduchý TEXT (bez formátovacích kódů MTEXT, jen %% kódy, \U+ a entity).
export function dekodujText(raw) {
  return dekodujAutocadKody(dekodujXmlEntity(String(raw ?? '').replace(/\\U\+([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))))).trim();
}
