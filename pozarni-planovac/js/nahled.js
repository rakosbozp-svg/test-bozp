// Náhled operativní karty (list A4 podle vzoru HZS SČK) pro obrazovku a tisk z prohlížeče.
// Rozvržení i obsah jsou společné s PDF (js/kartaRozvrzeni.js, js/kartaData.js); rozměry jsou v mm a písmo je stejné (Roboto).
import { esc } from './formular.js';
import { najdiZnacku } from './znacky.js';
import { rozvrzeniListu, umistiBunky, VELIKOSTI_PISMA, IKONA_MM } from './kartaRozvrzeni.js';
import { jeZnackaKarty, svgZnackyKarty } from './kartaZnacky.js';

const segment = (s) => {
  if (s.chybi) return '<span class="chybi">…</span>';
  const tridy = [s.b && 'b', s.u && 'u', s.odznak && 'odznak'].filter(Boolean).join(' ');
  const styl = [s.velikost && s.velikost !== 1 ? `font-size:${s.velikost}em` : '', s.c ? `color:${s.c}` : ''].filter(Boolean).join(';');
  return tridy || styl ? `<span${tridy ? ` class="${tridy}"` : ''}${styl ? ` style="${styl}"` : ''}>${esc(s.t)}</span>` : esc(s.t);
};
const text = (seg) => seg.map(segment).join('');
const znacka = (id, mm) => {
  if (!id) return '';
  if (jeZnackaKarty(id)) return svgZnackyKarty(id, mm);
  const z = najdiZnacku(id); return z ? `<img src="${esc(z.png)}" alt="${esc(z.nazev)}" title="${esc(z.id)} – ${esc(z.nazev)}" style="max-height:${mm}mm">` : '';
};

function tabulka(t) {
  const radky = umistiBunky(t).map((r) => `<tr${r.minH ? ` style="height:${r.minH}mm"` : ''}>${r.bunky.map((b) => {
    const tridy = [b.zn !== undefined && 'zn', b.stred && 'str', b.svisleStred && 'sv', r.pas && 'pas'].filter(Boolean).join(' ');
    const attr = `${(b.span || 1) > 1 ? ` colspan="${b.span}"` : ''}${(b.rowspan || 1) > 1 ? ` rowspan="${b.rowspan}"` : ''}${tridy ? ` class="${tridy}"` : ''}${b.fill ? ` style="background:${b.fill}"` : ''}`;
    const obsah = b.zn !== undefined ? znacka(b.zn, 8) : `${b.ikony?.length ? `<span class="ikony">${b.ikony.map((id) => znacka(id, IKONA_MM)).join('')}</span>` : ''}${text(b.seg || [])}`;
    return `<td${attr}>${obsah}</td>`;
  }).join('')}</tr>`).join('');
  return `<table class="okt"><colgroup>${t.mriz.map((w) => `<col style="width:${w}mm">`).join('')}</colgroup><tbody>${radky}</tbody></table>`;
}

export function nahledKarty(list, projekt) {
  const R = rozvrzeniListu(list, projekt);
  const podpisy = R.podpisy.map((p) => `<table><tr><th>${esc(p.nadpis)}</th></tr>${p.radky.map(([a, b]) => `<tr><td><span class="st">${esc(a)}</span>${esc(b)}</td></tr>`).join('')}</table>`).join('');
  return `<div class="karta-obal"><p class="karta-varovani" hidden role="status"></p><article class="a4 karta-a4" style="--pt:${VELIKOSTI_PISMA[0]}pt"><div class="ok-ram">
    ${R.tabulky.map(tabulka).join('')}
    <div class="ok-dop">${text(R.doporuceni)}</div>
    <div class="ok-podpisy">${podpisy}</div>
    ${R.revize ? `<p class="ok-revize">${esc(R.revize)}</p>` : ''}
  </div></article></div>`;
}

// Zmenší písmo náhledu (stejné kroky jako PDF), aby se karta vešla na jeden list A4; jinak zobrazí upozornění (netiskne se).
// Volá se po vložení náhledu do stránky (měří se skutečná výška). Vrací { pt, jednaStrana }.
export function prizpusobNahled(koren) {
  const a = koren.querySelector('.karta-a4'), ram = a?.querySelector('.ok-ram'), info = koren.querySelector('.karta-varovani');
  if (!a || !ram) return null;
  const sonda = document.createElement('div'); sonda.style.cssText = 'position:absolute;visibility:hidden;height:100mm;width:1px';
  document.body.appendChild(sonda); const pxNaMm = sonda.getBoundingClientRect().height / 100; sonda.remove();
  if (!pxNaMm) return null;                                                   // náhled není vidět (skrytá záložka)
  let vysledek = null;
  a.style.zoom = '';                                                          // měří se ve skutečné velikosti
  ram.classList.add('meri');
  for (const pt of VELIKOSTI_PISMA) {
    a.style.setProperty('--pt', `${pt}pt`);
    if (ram.getBoundingClientRect().height / pxNaMm <= 277) { vysledek = { pt, jednaStrana: true }; break; }
  }
  ram.classList.remove('meri');
  vysledek ||= { pt: VELIKOSTI_PISMA.at(-1), jednaStrana: false };
  const obal = koren.querySelector('.karta-obal'), sirka = a.getBoundingClientRect().width;   // na obrazovce zmenšit na šířku sloupce (tisk má zoom 1)
  if (obal && sirka > obal.clientWidth && obal.clientWidth > 0) a.style.zoom = String(Math.max(0.35, obal.clientWidth / sirka));
  if (info) {
    info.hidden = vysledek.jednaStrana;
    info.textContent = vysledek.jednaStrana ? '' : `Karta se nevejde na jednu stranu A4 ani při písmu ${String(vysledek.pt).replace('.', ',')} pt – zkraťte texty (nejčastěji doporučení). Textová část karty má být na jednom listu A4 (Hanuška 1996, kap. 3.1).`;
  }
  return vysledek;
}
