// Panely editoru výkresu: Vlastnosti (prvek / list / podklad) a Vrstvy.
import * as P from './prvky.js';
import { esc } from './render.js';
import { naCislo, zCisla } from '../formular.js';
import { zeptejSe, potvrd, oznam } from '../dialogy.js';
import { ikona } from '../ikony.js';
import { normalizujVelikost, VELIKOST_MIN, VELIKOST_MAX, VELIKOST_KROK } from '../model.js';

const NAZVY = { stena: 'Stěna', cara: 'Čára', trasa: 'Úniková cesta', plocha: 'Nástupní plocha a komunikace pro techniku', obdelnik: 'Obdélník', elipsa: 'Elipsa', volna: 'Volná kresba', text: 'Text', znacka: 'Značka', dvere: 'Dveře' };
const f1 = (n) => zCisla(Math.round(n * 100) / 100);

export function vykresliPanelVykresu(druh, host, ed) {
  const h = [];  // handlery indexované přes data-h
  const reg = (fn) => { h.push(fn); return h.length - 1; };
  const vyber = ed.vyber();

  // --- stavební kameny ---
  const pole = (label, hodnota, fn, { cislo = false, tip = '' } = {}) => `<label class="f"><span>${label}</span><input type="text" ${cislo ? 'inputmode="decimal"' : ''} data-h="${reg(fn)}" data-cislo="${cislo ? 1 : 0}" value="${esc(hodnota)}" ${tip ? `title="${esc(tip)}"` : ''}></label>`;
  const vyberHtml = (label, hodnoty, akt, fn) => `<label class="f"><span>${label}</span><select data-h="${reg(fn)}">${hodnoty.map(([k, n]) => `<option value="${esc(k)}" ${k === akt ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
  const zaskrt = (label, hodnota, fn) => `<label class="chk"><input type="checkbox" data-h="${reg(fn)}" ${hodnota ? 'checked' : ''}> ${label}</label>`;
  const tlacitko = (label, fn, cls = '') => `<button type="button" class="btn mal ${cls}" data-h="${reg(fn)}" data-klik="1">${label}</button>`;
  const barvy = (label, aktualni, fn, povolNic = false) => `<div class="f"><span>${label}</span><div class="barvy-vyber">${Object.values(BARVY_E()).map(([c, n]) => `<button type="button" class="barva ${aktualni === c ? 'akt' : ''}" style="background:${c}" title="${esc(n)}" data-h="${reg(() => fn(c))}" data-klik="1"></button>`).join('')}${povolNic ? `<button type="button" class="barva zadna ${!aktualni ? 'akt' : ''}" title="Bez výplně" data-h="${reg(() => fn(null))}" data-klik="1">∅</button>` : ''}<input type="color" value="${/^#[0-9a-f]{6}$/i.test(aktualni || '') ? aktualni : '#000000'}" data-h="${reg(fn)}" aria-label="${label} – vlastní"></div></div>`;
  const velikost = (label, hodnota, fn, nahled) => {
    const i = reg(fn);
    return `<div class="f vel" data-vel="${i}"><span>${label} (mm na papíře, ${VELIKOST_MIN}–${VELIKOST_MAX})</span><div class="vel-r"><button type="button" class="btn mal" data-vel-krok="-1" aria-label="Zmenšit o 0,1">−</button><input type="text" inputmode="decimal" data-vel-text value="${zCisla(hodnota)}" aria-label="${label}"><button type="button" class="btn mal" data-vel-krok="1" aria-label="Zvětšit o 0,1">+</button></div><input type="range" min="${VELIKOST_MIN}" max="${VELIKOST_MAX}" step="${VELIKOST_KROK}" value="${hodnota}" data-vel-range aria-label="${label} – posuvník"></div>`;
  };

  let html = '';
  const zmen = (fn) => (val) => { fn(val); ed.commit(); };

  if (druh === 'vrstvy') {
    html = `<h3>Vrstvy</h3><p class="napoveda">Spodní vrstva se kreslí první. Zamčená vrstva se nedá vybírat ani upravovat, skrytá se nevykresluje ani neexportuje. Bez zvolené aktivní vrstvy (kolečko) se nové prvky ukládají do vhodné vrstvy podle druhu.</p><ul class="vrstvy">` +
      ed.v.vrstvy.map((l, i) => `<li class="${ed.S.aktVrstva === l.id ? 'akt' : ''}">
        <input type="radio" name="aktv" ${ed.S.aktVrstva === l.id ? 'checked' : ''} data-h="${reg(() => { ed.nastavAktVrstvu(l.id); vykresliPanelVykresu('vrstvy', host, ed); })}" title="Aktivní vrstva pro nové prvky" aria-label="Aktivní vrstva ${esc(l.nazev)}">
        <button type="button" class="ikona" title="${l.viditelna ? 'Skrýt' : 'Zobrazit'}" aria-label="${l.viditelna ? 'Skrýt vrstvu' : 'Zobrazit vrstvu'}" data-h="${reg(() => { l.viditelna = !l.viditelna; ed.commit(); })}" data-klik="1">${ikona(l.viditelna ? 'oko' : 'okoVypnuto', 16)}</button>
        <button type="button" class="ikona" title="${l.zamcena ? 'Odemknout' : 'Zamknout'}" aria-label="${l.zamcena ? 'Odemknout vrstvu' : 'Zamknout vrstvu'}" data-h="${reg(() => { l.zamcena = !l.zamcena; ed.commit(); })}" data-klik="1">${ikona(l.zamcena ? 'zamek' : 'zamekOtevreny', 16)}</button>
        <input type="text" value="${esc(l.nazev)}" data-h="${reg((t) => { if (t.trim()) { l.nazev = t.trim(); ed.commit(); } })}" aria-label="Název vrstvy">
        <button type="button" class="ikona" title="Níže" aria-label="Posunout vrstvu níže" data-h="${reg(() => { if (i > 0) { [ed.v.vrstvy[i - 1], ed.v.vrstvy[i]] = [ed.v.vrstvy[i], ed.v.vrstvy[i - 1]]; ed.commit(); } })}" data-klik="1">${ikona('dolu', 16)}</button>
        <button type="button" class="ikona" title="Výše" aria-label="Posunout vrstvu výše" data-h="${reg(() => { if (i < ed.v.vrstvy.length - 1) { [ed.v.vrstvy[i + 1], ed.v.vrstvy[i]] = [ed.v.vrstvy[i], ed.v.vrstvy[i + 1]]; ed.commit(); } })}" data-klik="1">${ikona('nahoru', 16)}</button>
        <button type="button" class="ikona" title="Smazat vrstvu (prvky se přesunou do první zbývající vrstvy)" aria-label="Smazat vrstvu" data-h="${reg(() => {
          if (ed.v.vrstvy.length < 2) return oznam('Poslední vrstvu nelze smazat.');
          const cil = ed.v.vrstvy.find((x) => x.id !== l.id).id; ed.v.prvky.forEach((p) => { if (p.vrstva === l.id) p.vrstva = cil; }); ed.v.vrstvy.splice(i, 1); if (ed.S.aktVrstva === l.id) ed.nastavAktVrstvu(null); ed.commit();
        })}" data-klik="1">${ikona('zavrit', 16)}</button></li>`).reverse().join('') + `</ul>${tlacitko('+ Nová vrstva', async () => { const n = await zeptejSe('Název nové vrstvy'); if (n?.trim()) { ed.v.vrstvy.push({ id: `v_${Math.random().toString(36).slice(2, 8)}`, nazev: n.trim(), viditelna: true, zamcena: false }); ed.commit(); } })}`;
  } else if (vyber.length === 0) {
    const v = ed.v, nast = ed.projekt.nastaveni;
    const pz = v.pozadi, pr = pz && ed.projekt.prilohy[pz.prilohaId];
    html = `<h3>List</h3>
      ${vyberHtml('Orientace A4', [['na_sirku', 'Na šířku'], ['na_vysku', 'Na výšku']], v.orientace, zmen((t) => { v.orientace = t; }))}
      ${vyberHtml('Měřítko tisku', [...new Set([...P.MERITKA, v.meritko.pomer])].sort((a, b) => a - b).map((m) => [String(m), `1 : ${m}`]), String(v.meritko.pomer), zmen((t) => { zmenMeritko(ed, Number(t)); }))}
      ${tlacitko('Navrhnout měřítko podle obsahu', () => { const n = P.navrhniMeritko(v); if (!n) return oznam('Výkres je prázdný – není z čeho měřítko navrhnout.'); v.meritko.pomer = n; P.vycentrujOkno(v); ed.commit(); })}
      ${tlacitko('Vycentrovat obsah v rámu', () => { P.vycentrujOkno(v); ed.commit(); })}
      ${zaskrt('Síť 10 × 10 m', v.sit10m, zmen((c) => { v.sit10m = c; }))}
      ${pole('Severka – úhel (° po směru hodin, 0 = nahoru)', v.severka.uhel === null ? '' : zCisla(v.severka.uhel), zmen((t) => { const n = naCislo(t); v.severka.uhel = t.trim() === '' ? null : Number.isNaN(n) ? v.severka.uhel : n; }), { cislo: true, tip: 'Prázdné = severka neurčena' })}
      ${zaskrt('Zobrazit legendu značek', v.legendaZobrazit, zmen((c) => { v.legendaZobrazit = c; }))}
      ${v.meritkoZdroj ? `<p class="${v.meritkoZdroj.overeno ? '' : 'varuj'}">${ikona(v.meritkoZdroj.overeno ? 'ok' : 'pozor', 14)} Měřítko importu: ${esc(v.meritkoZdroj.popis)} – ${v.meritkoZdroj.overeno ? 'ověřeno' : 'NEOVĚŘENO'}.</p>${v.meritkoZdroj.overeno ? '' : tlacitko('Kalibrovat podle známé délky', () => ed.nastavNastroj('kalibrace'))}` : ''}
      <h4>Razítko</h4>
      ${['nazev:Název objektu', 'zpracoval:Zpracoval', 'schvalil:Schválil'].map((x) => { const [k, n] = x.split(':'); return pole(n, v.razitko[k], zmen((t) => { v.razitko[k] = t; })); }).join('')}
      <label class="f"><span>Datum</span><input type="date" value="${esc(v.razitko.datum)}" data-h="${reg(zmen((t) => { v.razitko.datum = t; }))}"></label>
      <h4>Výchozí velikosti nových prvků</h4>
      ${velikost('Značka', nast.velikostZnacky, (n) => { nast.velikostZnacky = normalizujVelikost(n); ed.uloz(); })}
      ${velikost('Text', nast.velikostTextu, (n) => { nast.velikostTextu = normalizujVelikost(n); ed.uloz(); })}
      <h4>Podklad</h4>
      ${pz && pr ? `<p><b>${esc(pz.nazev)}</b> (${pz.sirkaPx} × ${pz.vyskaPx} px)</p>
        <p class="${pz.kalibrace ? '' : 'varuj'}">${pz.kalibrace ? `${ikona('ok', 14)} Zkalibrováno: ${f1(pz.kalibrace.delkaM)} m` : `${ikona('pozor', 14)} Měřítko podkladu NENÍ ověřeno – délky tras jsou jen orientační. Zkalibrujte podle známé délky.`}</p>
        ${tlacitko('Kalibrovat podle známé délky', () => ed.nastavNastroj('kalibrace'))}
        <label class="f"><span>Krytí podkladu (0–1)</span><input type="range" min="0.1" max="1" step="0.05" value="${pz.kryti}" data-h="${reg((t) => { pz.kryti = Number(t); ed.commit(); })}" data-range="1"></label>
        ${tlacitko('Odebrat podklad', async () => { if (await potvrd('Odebrat podklad z listu?', { ano: 'Odebrat', nebezpecne: true })) { v.pozadi = null; ed.commit(); } }, 'nebezp')}`
        : `<p class="napoveda">Žádný podklad. Tlačítkem Podklad… v liště vložíte obrázek (PNG/JPG), pak ho zkalibrujete podle známé délky.</p>`}`;
  } else if (vyber.length > 1) {
    html = `<h3>Vybráno ${vyber.length} prvků</h3>${vrstvaVyber(ed, vyber, vyberHtml, zmen)}
      ${vyber.every((p) => p.druh === 'cara') ? tlacitko('Převést čáry na stěny', () => { vyber.forEach((p) => ed.prevedDruh(p, 'stena')); ed.commit(); }) : ''}${vyber.every((p) => p.druh === 'stena') ? tlacitko('Převést stěny na čáry', () => { vyber.forEach((p) => ed.prevedDruh(p, 'cara')); ed.commit(); }) : ''}
      ${tlacitko('Duplikovat', () => ed.prvkyKopie())}${tlacitko('Smazat', () => ed.smazVyber(), 'nebezp')}<p class="napoveda">Táhněte úchyty pro změnu velikosti a otočení celého výběru.</p>`;
  } else {
    const p = vyber[0], v = ed.v, c = (fn) => zmen(fn);
    const num = (label, key, opt = {}) => pole(label, f1(p[key]), c((t) => { const n = naCislo(t); if (!Number.isNaN(n) && n !== null) p[key] = n; }), { cislo: true, ...opt });
    let typ = '';
    if (p.druh === 'stena') typ = `${num('Tloušťka stěny (m)', 'tloustkaM')}<p>Délka: <b>${P.formatDelky(P.delkaTrasy(p))}</b>, bodů: ${p.body.length}</p>`;
    if (p.druh === 'cara' || p.druh === 'volna' || p.druh === 'trasa') typ = `${num('Tloušťka čáry (mm na papíře)', 'tloustka')}`;
    if (p.druh === 'cara') typ += vyberHtml('Styl', [['plna', 'Plná'], ['carkovana', 'Čárkovaná'], ['carkocara', 'Čerchovaná']], p.styl, c((t) => { p.styl = t; }));
    if (p.druh === 'trasa') typ += zaskrt('Šipka na konci', p.sipka, c((x) => { p.sipka = x; })) + `<p>Délka trasy: <b>${P.formatDelky(P.delkaTrasy(p))}</b>${P.meritkoOvereno(v) ? '' : ' <span class="varuj">(měřítko podkladu neověřeno)</span>'}</p>`;
    if (p.druh === 'plocha' || p.druh === 'obdelnik' || p.druh === 'elipsa') typ = `${num('Tloušťka obrysu (mm na papíře)', 'tloustka')}${barvy('Výplň', p.vypln, c((x) => { p.vypln = x; }), true)}${num('Krytí výplně (0–1)', 'kryti')}`;
    if (p.druh === 'obdelnik') typ += num('Střed X (m)', 'cx') + num('Střed Y (m)', 'cy') + num('Šířka (m)', 'w') + num('Výška (m)', 'h') + num('Otočení (°)', 'uhel');
    if (p.druh === 'elipsa') typ += num('Střed X (m)', 'cx') + num('Střed Y (m)', 'cy') + num('Poloosa X (m)', 'rx') + num('Poloosa Y (m)', 'ry') + num('Otočení (°)', 'uhel');
    if (p.druh === 'text') typ = `<label class="f"><span>Text</span><textarea rows="3" data-h="${reg(c((t) => { p.text = t; }))}">${esc(p.text)}</textarea></label>${velikost('Výška písma', p.vyska, (n) => { p.vyska = normalizujVelikost(n); ed.commit(); })}${num('X (m)', 'x')}${num('Y (m)', 'y')}${num('Otočení (°)', 'uhel')}`;
    if (p.druh === 'znacka') typ = `<p><img class="zn-nahled" src="${esc(ed.katalog.get(p.znackaId)?.png || '')}" alt=""> ${esc(ed.katalog.get(p.znackaId)?.nazev || p.znackaId || 'bez značky')}</p>${tlacitko('Změnit značku…', () => ed.zmenaZnacky(p))}${velikost('Velikost značky', p.velikost, (n) => { p.velikost = normalizujVelikost(n); ed.commit(); })}${num('X (m)', 'x')}${num('Y (m)', 'y')}${num('Otočení (°)', 'uhel')}`;
    if (p.druh === 'dvere') {
      const st = p.stenaId ? P.najdi(v.prvky, p.stenaId) : null;
      typ = `${pole('Šířka dveří (m)', f1(p.sirkaM), (t) => { const n = naCislo(t); if (n > 0) { P.nastavSirkuDveri(p, n, v.prvky); ed.commit(); } }, { cislo: true })}
        ${vyberHtml('Typ', [['jednokridle', 'Jednokřídlé'], ['dvoukridle', 'Dvoukřídlé'], ['vrata', 'Vrata']], p.typ, (t) => { P.nastavTypDveri(p, t); ed.commit(); })}
        ${p.typAuto ? '<p class="napoveda">Typ se volí automaticky podle šířky. Ruční volba typu to vypne.</p>' : tlacitko('Typ podle šířky', () => { p.typAuto = true; p.typ = P.typDveriPodleSirky(p.sirkaM); ed.commit(); })}
        ${p.typ !== 'vrata' ? tlacitko('Otočit směr otevírání', () => { p.smer *= -1; ed.commit(); }) : ''}${p.typ === 'jednokridle' ? tlacitko('Přehodit závěsy', () => { p.zavesy *= -1; ed.commit(); }) : ''}
        <p>${st ? `Připojeno ke stěně (${P.formatDelky(P.delkaTrasy(st))}).` : 'Dveře nejsou připojeny ke stěně – jdou volně přesunout.'}</p>
        ${st ? tlacitko('Odpojit od stěny', () => { P.odpojDvere(p, v.prvky); ed.commit(); }) : ''}
        ${tlacitko(st ? 'Přepojit na nejbližší stěnu' : 'Připojit k nejbližší stěně', () => { if (!P.pripojDvere(p, v.prvky, [p.x, p.y])) { oznam('Ve výkresu není žádná stěna.'); return; } ed.commit(); })}`;
    }
    const maBarvu = 'barva' in p && p.druh !== 'plocha' && p.druh !== 'obdelnik' && p.druh !== 'elipsa' ? barvy('Barva', p.barva, c((x) => { p.barva = x; })) : '';
    const kontrola = p.kKontrole ? `<p class="varuj">${ikona('pozor', 14)} Převod z importu je nejistý – zkontrolujte polohu a vlastnosti.</p>${tlacitko('Označit jako zkontrolované', () => { delete p.kKontrole; ed.commit(); })}` : '';
    const prevod = p.druh === 'cara' ? tlacitko('Převést na stěnu', () => { ed.prevedDruh(p, 'stena'); ed.commit(); }) : p.druh === 'stena' ? tlacitko('Převést na čáru', () => { ed.prevedDruh(p, 'cara'); ed.commit(); }) : '';
    html = `<h3>${NAZVY[p.druh]}</h3>${kontrola}${typ}${prevod}${maBarvu}${p.druh === 'plocha' || p.druh === 'obdelnik' || p.druh === 'elipsa' ? barvy('Barva obrysu', p.barva, c((x) => { p.barva = x; })) : ''}${vrstvaVyber(ed, vyber, vyberHtml, zmen)}
      ${tlacitko('Duplikovat', () => ed.prvkyKopie())}${tlacitko('Nahoru', () => zmenPoradi(ed, p, 1))}${tlacitko('Dolů', () => zmenPoradi(ed, p, -1))}${tlacitko('Smazat', () => ed.smazVyber(), 'nebezp')}`;
  }
  host.innerHTML = html;

  // --- obsluha ---
  const vol = (el) => { const fn = h[Number(el.dataset.h)]; if (!fn) return; if (el.type === 'checkbox') fn(el.checked); else if (el.dataset.cislo !== undefined) fn(el.value); else fn(el.value); };
  host.onchange = (e) => { const el = e.target; if (el.dataset.velText !== undefined) return velText(el); if (el.dataset.velRange !== undefined) return velRange(el, true); if (el.dataset.h !== undefined && el.dataset.klik === undefined) vol(el); };
  host.oninput = (e) => { if (e.target.dataset.velRange !== undefined) velRange(e.target, false); };
  host.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.velKrok !== undefined) { const w = b.closest('[data-vel]'), t = w.querySelector('[data-vel-text]'), n = naCislo(t.value); t.value = zCisla(normalizujVelikost((Number.isNaN(n) || n === null ? VELIKOST_MIN : n) + Number(b.dataset.velKrok) * (e.shiftKey ? 1 : VELIKOST_KROK))); return velText(t); }
    if (b.dataset.klik !== undefined) vol(b);
  };
  const velText = (t) => { const w = t.closest('[data-vel]'), n = naCislo(t.value); if (Number.isNaN(n) || n === null) return; const x = normalizujVelikost(n); t.value = zCisla(x); w.querySelector('[data-vel-range]').value = x; h[Number(w.dataset.vel)](x); };
  const velRange = (r, konec) => { const w = r.closest('[data-vel]'), x = normalizujVelikost(Number(r.value)); w.querySelector('[data-vel-text]').value = zCisla(x); if (konec) h[Number(w.dataset.vel)](x); };
  host.querySelectorAll('input[type=color]').forEach((c) => { c.oninput = null; });
}

const BARVY_E = () => P.BARVY;

function vrstvaVyber(ed, vyber, vyberHtml, zmen) {
  const spolecna = vyber.every((p) => p.vrstva === vyber[0].vrstva) ? vyber[0].vrstva : '';
  return vyberHtml('Vrstva', [...(spolecna ? [] : [['', '— různé —']]), ...ed.v.vrstvy.map((l) => [l.id, l.nazev])], spolecna, zmen((id) => { if (id) vyber.forEach((p) => { p.vrstva = id; }); }));
}

function zmenPoradi(ed, p, smer) {
  const a = ed.v.prvky, i = a.indexOf(p), j = i + (smer > 0 ? 1 : -1);
  if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; ed.commit();
}

// Změna měřítka tisku zachová střed zobrazeného výřezu.
function zmenMeritko(ed, pomer) {
  const v = ed.v, { ram } = P.rozlozeniListu(v), cx = v.okno.x + (ram.w * v.meritko.pomer) / 2000, cy = v.okno.y + (ram.h * v.meritko.pomer) / 2000;
  v.meritko.pomer = pomer; v.okno = { x: cx - (ram.w * pomer) / 2000, y: cy - (ram.h * pomer) / 2000 };
}
