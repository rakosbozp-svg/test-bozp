import * as M from './model.js';
import * as U from './ulozeni.js';
import { nactiKatalog } from './znacky.js';
import { vykresliKartu, pripoj, esc } from './formular.js';
import { nahledKarty, prizpusobNahled } from './nahled.js';
import { vykresliEvak, pripojEvak, nahledEvak } from './evakuace.js';
import { panelUplnosti, panelProjektu, METODIKA } from './panely.js';
import { METODIKA_EVAK } from './evakuace.js';
import { katalogProjektu } from './evakznacky.js';
import { SCHEMA_ZAKLAD, SCHEMA_TEXT, METODIKA_OP } from './operativniplan.js';
import { vykresliSchema, pripojSchema, schemaJakoText, nahledSchema } from './textlisty.js';
import { navrhZKarty, navrhZPlanu, pouzijNavrh } from './prebirani.js';
import { radkyZPdf, rozborPbr, navrhZPbr, slucRozbory } from './pbr.js';
import { stranyZDocx } from './docx.js';
import { ocrPdf } from './ocr.js';
import { otevriPdf } from './kresleni/import/pdf.js';
import { vykresliSap, pripojSap } from './sapUI.js';
import { sapJakoText, nastavKontextSaP, kontextSaP } from './sap.js';
import { vykresliDotaznik, pripojDotaznik } from './dotaznikUI.js';
import { navrhZDotazniku, dotaznikJakoText, OTAZKY } from './dotaznik.js';
import { dotaznikDoPdf, dotaznikZPdf } from './pdf/dotaznikPdf.js';
import { zkontrolujUplnost, souhrn as souhrnUplnosti } from './uplnost.js';
import { vytvorEditor } from './kresleni/editor.js';
import { zeptejSe, potvrd, oznam, formular } from './dialogy.js';
import { exportujPdf, stahniBajty, jmenoPdf, nactiFonty } from './pdf/export.js';
import { ikona } from './ikony.js';
import { vykresliPanelVykresu } from './kresleni/panel-vykres.js';
import { vlozPodklad } from './kresleni/podklad.js';
import { importujSoubor, vlozVektor } from './kresleni/import/index.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), topAkce = $('#top-akce'), hlaska = $('#hlaska');
let katalog = [];
const S = { p: null, listId: null, zalozka: 'formular', panel: 'uplnost', stav: '', ed: null };
const VYKRES = ['situace', 'pudorys', 'schema', 'evak_plan'];

function ohlas(text, trvale = false) {
  hlaska.hidden = !text; hlaska.textContent = text || '';
  if (text && !trvale) setTimeout(() => { if (hlaska.textContent === text) hlaska.hidden = true; }, 5000);
}

// ---------- ukládání ----------
let casovac = null;
function uloz(ihned = false) {
  S.p.zmeneno = new Date().toISOString();
  const jed = () => {
    casovac = null;
    if (!S.p) return;
    U.uloz(S.p).then((r) => {
      S.stav = r.ok ? `Uloženo ${new Date().toLocaleTimeString('cs-CZ')}` : 'NEULOŽENO';
      if (!r.ok) ohlas(`Projekt se nepodařilo uložit do prohlížeče (${r.chyba}). Stáhněte si ho: Stáhnout → Editovatelný projekt.`, true);
      const el = $('#stav'); if (el) { el.textContent = S.stav; el.classList.toggle('chyba', !r.ok); }
    });
  };
  clearTimeout(casovac);
  if (ihned) jed(); else { S.stav = 'Ukládám…'; const el = $('#stav'); if (el) el.textContent = S.stav; casovac = setTimeout(jed, 350); }
}
window.addEventListener('beforeunload', () => { if (casovac && S.p) { clearTimeout(casovac); M.uklidPrilohy(S.p); U.uloz(S.p); } });

// ---------- směrování ----------
function smeruj() {
  if (casovac && S.p) { clearTimeout(casovac); casovac = null; M.uklidPrilohy(S.p); U.uloz(S.p); }   // nic se neztratí při rychlém odchodu z editoru
  const [, , id, listId] = location.hash.split('/');
  if (id) {
    const p = U.nacti(id);
    if (!p) { ohlas('Projekt nebyl nalezen v tomto prohlížeči.'); location.hash = '#/'; return; }
    if (!S.p || S.p.id !== id) { S.p = p; S.zalozka = 'formular'; }
    S.listId = (listId === 'dotaznik' && !M.jeEvakuace(S.p)) || (listId && S.p.listy.some((l) => l.id === listId)) ? listId : S.p.listy[0]?.id ?? null;
    U.nastavPosledni(id);
    editor();
  } else { S.p = null; dashboard(); }
}
window.addEventListener('hashchange', smeruj);
// Přechod na adresu; když už stránka na té adrese je, hashchange nenastane – překreslí se přímo (např. po smazání zobrazeného listu).
function jdi(hash) { if (location.hash === hash) smeruj(); else location.hash = hash; }

// ---------- dashboard ----------
// Úvodní stránka má dva oddělené režimy: DZP (pro hasiče) a evakuační plány (pro osoby v objektu). Volba je v adrese (#/dzp, #/evakuace)
// a pamatuje se v prohlížeči; logo vrací do naposledy zvoleného režimu.
const REZIMY = {
  dzp: { nazev: 'DZP', dlouhy: 'Dokumentace zdolávání požárů', ikona: 'plamen', popis: 'Operativní karty a plány pro velitele zásahu (HZS).',
    hero: ['Dokumentace zdolávání požárů', 'Operativní karty a plány, které velitel zásahu přečte za minutu', 'Vyplníte kartu podle vzoru HZS, nakreslíte situaci a půdorys a aplikace pohlídá úplnost. Odborné údaje i právní soulad vždy ověřuje zpracovatel s HZS.'],
    novy: ['Nová DZP', 'Založte operativní kartu podle vzoru HZS', 'Pojmenujte projekt a vyberte, zda vytváříte kartu, nebo složitější plán.', 'např. DZP Litice', 'Založit DZP'],
    typy: ['operativni_karta', 'operativni_plan'] },
  evakuace: { nazev: 'Evakuační plány', dlouhy: 'Požární evakuační plány', ikona: 'sipka', popis: 'Únikové plány podlaží a textová část pro osoby v objektu.',
    hero: ['Požární evakuační plány', 'Únikové plány podlaží, podle kterých lidé najdou cestu ven', 'Textová část podle § 33 vyhlášky č. 246/2001 Sb. a grafické listy podlaží podle ČSN ISO 23601. Evakuační plán není DZP – oba druhy dokumentace se nemíchají.'],
    novy: ['Nový evakuační plán', 'Založte požární evakuační plán', 'Vznikne textová část (§ 33) a první list podlaží A3. Další podlaží přidáte v editoru.', 'např. Evakuační plán – Hala 5', 'Založit evakuační plán'],
    typy: ['evakuacni_plan'] },
};
const rezimProjektu = (typ) => (typ === 'evakuacni_plan' ? 'evakuace' : 'dzp');
function aktualniRezim() {
  const z = location.hash.split('/')[1];
  if (REZIMY[z]) { try { localStorage.setItem('pp-rezim', z); } catch { /* bez úložiště */ } return z; }
  try { const r = localStorage.getItem('pp-rezim'); if (REZIMY[r]) return r; } catch { /* bez úložiště */ }
  return 'dzp';
}
function nastavLogo(rezim) {
  const el = $('#logo small'); if (el) el.textContent = REZIMY[rezim].nazev; const a = $('#logo'); if (a) a.href = `#/${rezim}`;
  document.querySelectorAll('#rezim [data-rezim]').forEach((x) => { if (x.dataset.rezim === rezim) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
}

// ---------- záloha všech projektů ----------
const DEN = 86400000;
const sklon = (jeden, dva, pet) => (n) => `${n} ${n === 1 ? jeden : n >= 2 && n <= 4 ? dva : pet}`;
const projektu = sklon('projekt', 'projekty', 'projektů');   // 1 projekt, 2 projekty, 5 projektů
const odpovedi = sklon('odpověď', 'odpovědi', 'odpovědí'), udaju = sklon('údaj', 'údaje', 'údajů');
const malym = (t) => t.charAt(0).toLowerCase() + t.slice(1);   // „operativní karta (DZP)“ – zkratky zůstanou velkými
function pripominkaZalohy(vse) {
  if (!vse.length || !U.dostupne()) return '';
  const posl = U.posledniZaloha(), zmenene = vse.filter((x) => !posl || x.zmeneno > posl).length;
  if (!zmenene || (posl && Date.now() - Date.parse(posl) < 7 * DEN)) return '';
  const kdy = posl ? `Poslední záloha všech projektů: ${new Date(posl).toLocaleDateString('cs-CZ')} (před ${Math.floor((Date.now() - Date.parse(posl)) / DEN)} dny). Od té doby změněno projektů: ${zmenene}.` : `Projekty (${vse.length}) ještě nebyly zálohovány.`;
  return `<div class="rk-alert rk-alert--warn" role="status" id="d-pripominka"><span class="rk-alert__icon">${ikona('pozor', 18)}</span><div class="rk-alert__text"><span class="rk-alert__title">Zálohujte projekty</span><span class="rk-alert__body">${esc(kdy)} Projekty jsou jen v tomto prohlížeči – vymazání dat prohlížeče nebo přeinstalace je smaže.</span></div><button type="button" class="rk-btn rk-btn--secondary rk-btn--sm rk-alert__action" id="d-zalohovat-ted">Zálohovat teď</button></div>`;
}
function zalohovatVse() {
  const n = U.seznam().length;
  if (!n) { oznam('V tomto prohlížeči zatím nejsou žádné projekty.', { titul: 'Záloha' }); return; }
  U.stahniZalohu(); ohlas(`Záloha je stažená (${projektu(n)}). Uložte soubor mimo prohlížeč (disk, cloud).`);
  if (!S.p) dashboard();
}
async function obnovZalohu(z) {
  const titul = 'Obnovit ze zálohy';
  if (!z.projekty.length) { await oznam(`Záloha neobsahuje žádný použitelný projekt.${z.chyby.length ? `\n${z.chyby.join('\n')}` : ''}`, { titul }); return; }
  const ids = new Set(U.seznam().map((x) => x.id)), existuje = (p) => ids.has(p.id), nEx = z.projekty.filter(existuje).length;
  const evak = z.projekty.filter((p) => M.jeEvakuace(p)).length;
  const r = await formular({ titul, ano: 'Obnovit',
    html: `<p class="dlg__text">Záloha${z.vytvoreno ? ` z ${esc(new Date(z.vytvoreno).toLocaleString('cs-CZ'))}` : ''} obsahuje ${projektu(z.projekty.length)} (DZP: ${z.projekty.length - evak}, evakuační plány: ${evak}).${nEx ? ` ${nEx} z nich už v tomto prohlížeči ${nEx >= 2 && nEx <= 4 ? 'jsou' : 'je'}.` : ''} Nic se nepřepíše.</p>
      ${z.chyby.length ? `<p class="dlg__text varuj">Nepoužitelné projekty se přeskočí: ${esc(z.chyby.join('; '))}</p>` : ''}
      ${nEx ? `<div class="moznosti"><label class="moznost"><input type="radio" name="rezim" value="chybejici" checked><div><b>Obnovit jen chybějící projekty</b><span>Projekty, které v prohlížeči už jsou, zůstanou beze změny.</span></div></label>
        <label class="moznost"><input type="radio" name="rezim" value="kopie"><div><b>Obnovit vše – existující jako kopie</b><span>Ke stávajícím projektům se přidá verze ze zálohy s označením „(ze zálohy)“.</span></div></label></div>` : ''}
      <ul class="zaloha-seznam">${z.projekty.map((p) => `<li>${esc(p.nazev)} <small>${esc(malym(M.TYPY_DOKUMENTU_NAZVY[p.typ] || ''))}${existuje(p) ? ' · už je v prohlížeči' : ''}</small></li>`).join('')}</ul>` });
  if (!r.ok) return;
  const kopie = r.pole.rezim === 'kopie';
  let n = 0; const chyby = [];
  for (const p of z.projekty) {
    if (existuje(p)) { if (!kopie) continue; p.id = `proj_${Math.random().toString(36).slice(2, 10)}`; p.nazev += ' (ze zálohy)'; }
    const u = await U.uloz(p); if (u.ok) n++; else chyby.push(`${p.nazev}: ${u.chyba}`);
  }
  dashboard();
  ohlas(`Ze zálohy obnoveno: ${projektu(n)}.${chyby.length ? ` Neuloženo: ${chyby.join('; ')}` : ''}`);
}

function dashboard() {
  S.ed?.zrusit(); S.ed = null;
  topAkce.innerHTML = '';
  const rezim = aktualniRezim(), R = REZIMY[rezim]; nastavLogo(rezim);
  const vse = U.seznam(), sez = vse.filter((x) => rezimProjektu(x.typ) === rezim), jine = vse.length - sez.length, posl = U.posledni();
  const poslProj = sez.find((x) => x.id === posl) || sez[0];
  app.innerHTML = `<section class="dash dash--${rezim}">
    <header class="dash__hero rk-sh">
      <div class="rk-eyebrow">${R.hero[0]}</div>
      <h1 class="rk-sh__title dash__nadpis">${R.hero[1]}</h1>
      <p class="rk-sh__lead">${R.hero[2]}</p>
    </header>
    ${U.dostupne() ? '' : `<div class="varovani" role="alert">${ikona('pozor', 20)}<span>Úložiště prohlížeče není dostupné (soukromé okno nebo zablokovaná data). Projekt se neuloží – po úpravách použijte Stáhnout → Editovatelný projekt.</span></div>`}
    ${pripominkaZalohy(vse)}
    <section class="rk-callout">
      <div class="rk-callout__main">
        <header class="rk-sh rk-sh--dark"><div class="rk-eyebrow">${R.novy[0]}</div>
          <h2 class="rk-sh__title rk-sh__title--sm">${R.novy[1]}</h2>
          <p class="rk-sh__lead">${R.novy[2]}</p></header>
        <form id="d-novy">
          <label class="rk-field"><span class="rk-field__label">Název projektu</span><input class="rk-field__control" type="text" name="nazev" placeholder="${R.novy[3]}" required></label>
          ${rezim === 'dzp' ? '<label class="rk-field"><span class="rk-field__label">Druh dokumentace</span><select class="rk-field__control" name="typ"><option value="operativni_karta">Operativní karta</option><option value="operativni_plan">Operativní plán</option></select></label>' : '<input type="hidden" name="typ" value="evakuacni_plan">'}
          <div class="rk-callout__action"><button class="rk-btn rk-btn--primary" type="submit"><span>${R.novy[4]}</span><span class="rk-btn__arrow">→</span></button></div>
        </form>
      </div>
    </section>
    <div class="dlazdice">
      ${poslProj ? `<a class="rk-card rk-card--interactive" href="#/p/${esc(poslProj.id)}" id="d-pokracovat"><div class="rk-card__top"><span class="rk-tile">${ikona('slozka', 20)}</span></div><div class="rk-card__title">Pokračovat v projektu</div><div class="rk-card__body">${esc(poslProj.nazev)}<br><small>upraveno ${new Date(poslProj.zmeneno).toLocaleString('cs-CZ')}</small></div><div class="rk-card__link"><span>Otevřít</span><span class="rk-card__arrow">→</span></div></a>` : ''}
      <button type="button" class="rk-card rk-card--interactive" id="d-zaloha"><div class="rk-card__top"><span class="rk-tile">${ikona('stahnout', 20)}</span></div><div class="rk-card__title">Zálohovat všechny projekty</div><div class="rk-card__body">Jeden soubor se všemi projekty v prohlížeči (teď ${projektu(vse.length)}) – DZP i evakuační plány včetně podkladů. Obnovíte ho přes Importovat projekt.</div><div class="rk-card__link"><span>Stáhnout zálohu</span><span class="rk-card__arrow">→</span></div></button>
      <label class="rk-card rk-card--interactive" for="d-import"><div class="rk-card__top"><span class="rk-tile">${ikona('soubor', 20)}</span></div><div class="rk-card__title">Importovat projekt</div><div class="rk-card__body">Soubor .pplan.json (jeden projekt) nebo záloha všech projektů. Projekt se otevře v režimu podle svého druhu.</div><div class="rk-card__link"><span>Vybrat soubor</span><span class="rk-card__arrow">→</span></div><input type="file" id="d-import" class="sr-only" accept=".json,application/json"></label>
      <label class="rk-card rk-card--interactive" for="d-podklad"><div class="rk-card__top"><span class="rk-tile">${ikona('import', 20)}</span></div><div class="rk-card__title">Importovat podklad</div><div class="rk-card__body">DXF, SVG, PDF, PNG nebo JPG. ${rezim === 'dzp' ? 'Založí novou DZP a vloží podklad do situace.' : 'Založí nový evakuační plán a vloží podklad do listu podlaží.'}</div><div class="rk-card__link"><span>Vybrat soubor</span><span class="rk-card__arrow">→</span></div><input type="file" id="d-podklad" class="sr-only" accept=".dxf,.svg,.pdf,.png,.jpg,.jpeg,.dwg,image/png,image/jpeg,image/svg+xml,application/pdf"></label>
      ${rezim === 'dzp' && !window.__WEB__ ? `<button type="button" class="rk-card rk-card--interactive" id="d-litice"><div class="rk-card__top"><span class="rk-tile">${ikona('plamen', 20)}</span></div><div class="rk-card__title">Referenční projekt Litice</div><div class="rk-card__body">Jen potvrzené údaje o FVE a poznámky o rozsahu. Ostatní pole zůstávají prázdná.</div><div class="rk-card__link"><span>Založit z Litic</span><span class="rk-card__arrow">→</span></div></button>` : ''}
    </div>
    <section>
      <header class="rk-sh"><div class="rk-eyebrow">Uloženo v tomto prohlížeči</div><h2 class="rk-sh__title rk-sh__title--sm">${rezim === 'dzp' ? 'Vaše DZP' : 'Vaše evakuační plány'}</h2></header>
      <ul class="projekty" style="margin-top:var(--space-4)">${sez.map((x) => `<li><a href="#/p/${esc(x.id)}"><b>${esc(x.nazev)}</b><small>${esc(malym(M.TYPY_DOKUMENTU_NAZVY[x.typ] || x.typ))} · ${new Date(x.zmeneno).toLocaleString('cs-CZ')}</small></a>
        <button class="btn mal" data-akce="kopie" data-id="${esc(x.id)}">${ikona('kopie', 15)}Duplikovat</button><button class="btn mal" data-akce="stahnout" data-id="${esc(x.id)}">${ikona('stahnout', 15)}Stáhnout</button><button class="btn mal nebezp" data-akce="smaz" data-id="${esc(x.id)}">${ikona('smazat', 15)}Smazat</button></li>`).join('') || `<li class="prazdno">Zatím žádný ${rezim === 'dzp' ? 'projekt DZP' : 'evakuační plán'}.</li>`}</ul>
      ${jine ? `<p class="napoveda" style="margin-top:var(--space-3)">${rezim === 'dzp' ? `Evakuační plány (${jine}) najdete v režimu <a href="#/evakuace">Evakuační plány</a>.` : `Projekty DZP (${jine}) najdete v režimu <a href="#/dzp">DZP</a>.`}</p>` : ''}
      <p class="napoveda" style="margin-top:var(--space-3)">Projekty jsou uloženy lokálně v tomto prohlížeči a automaticky se nesynchronizují s webovou verzí ani jinými zařízeními. Vymazání dat prohlížeče je smaže – zálohujte tlačítkem Zálohovat všechny projekty.</p>
    </section>
  </section>`;
  $('#d-novy').onsubmit = (e) => {
    e.preventDefault(); const d = new FormData(e.target);
    const p = M.novyProjekt({ nazev: d.get('nazev').trim(), typ: d.get('typ') });
    U.uloz(p); location.hash = `#/p/${p.id}`;
  };
  $('#d-zaloha').onclick = zalohovatVse;
  if ($('#d-zalohovat-ted')) $('#d-zalohovat-ted').onclick = zalohovatVse;
  $('#d-import').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const text = await f.text(), z = M.nactiZalohu(text);
      if (z) { e.target.value = ''; await obnovZalohu(z); return; }
      const p = M.nactiProjekt(text);
      if (U.seznam().some((x) => x.id === p.id)) { p.id = `proj_${Math.random().toString(36).slice(2, 10)}`; p.nazev += ' (import)'; }
      const r = await U.uloz(p); if (!r.ok) throw new Error(r.chyba);
      location.hash = `#/p/${p.id}`;
    } catch (err) { ohlas(`Import selhal: ${err.message}`); }
  };
  $('#d-podklad').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const r = await importujSoubor(f); e.target.value = '';
      if (!r) return;
      const evak = rezim === 'evakuace', p = M.novyProjekt({ nazev: f.name.replace(/\.[^.]+$/, ''), typ: evak ? 'evakuacni_plan' : 'operativni_karta' }), sit = p.listy.find((l) => l.typ === (evak ? 'evak_plan' : 'situace'));
      if (r.typ === 'raster') vlozPodklad(p, sit.vykres, r.obrazek); else vlozVektor(sit.vykres, r.vysledek);
      const u = await U.uloz(p); if (!u.ok) throw new Error(u.chyba);
      location.hash = `#/p/${p.id}/${sit.id}`;
      if (r.souhrn) oznam(r.souhrn.join('\n') || 'Hotovo.', { titul: 'Import dokončen' });
    } catch (err) { await oznam(`Import podkladu selhal: ${err.message}`); }
  };
  if ($('#d-litice')) $('#d-litice').onclick = async () => {
    try {
      let text = globalThis.__LITICE__;
      if (!text) { const r = await fetch('data/litice.projekt.json'); if (!r.ok) throw new Error('soubor nenalezen'); text = await r.text(); }
      const p = M.nactiProjekt(text); p.id = `proj_${Math.random().toString(36).slice(2, 10)}`;
      U.uloz(p); location.hash = `#/p/${p.id}`;
    } catch (err) { ohlas(`Referenční projekt se nepodařilo načíst (${err.message}). Aplikaci je potřeba spustit přes webový server, ne z file://.`); }
  };
  app.querySelector('.projekty').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.id, p = U.nacti(id);
    if (b.dataset.akce === 'smaz' && await potvrd(`Smazat projekt „${p.nazev}“?`, { ano: 'Smazat', nebezpecne: true, popis: 'Projekt se odstraní z tohoto prohlížeče a nejde vrátit. Nejdřív si ho případně stáhněte.' })) { U.smaz(id); dashboard(); }
    if (b.dataset.akce === 'stahnout') U.stahni(p);
    if (b.dataset.akce === 'kopie') { p.id = `proj_${Math.random().toString(36).slice(2, 10)}`; p.nazev += ' (kopie)'; U.uloz(p); dashboard(); }
  };
}

// ---------- export PDF ----------
async function exportPdfDialog() {
  const p = S.p, katMapa = new Map(katalogProjektu(p, katalog).map((z) => [z.id, z]));
  const sh = souhrnUplnosti(zkontrolujUplnost(p, katalog));
  const zakladOp = p.typ === 'operativni_plan' && p.listy.some((l) => l.typ === 'op_zaklad' || l.typ === 'op_sap') && p.listy.some((l) => !['op_zaklad', 'op_sap'].includes(l.typ));
  const typy = { karta: 'operativní karta', situace: 'situace', pudorys: 'půdorys', schema: 'schéma', text: 'text', evak_text: 'evakuační plán – text', evak_plan: 'evakuační plán – podlaží', op_zaklad: 'OP – základní text', op_text: 'OP – textová část přílohy', op_sap: 'OP – výpočet SaP' };
  const dlg = await formular({
    titul: 'Export do PDF',
    html: `<p class="dlg__text">Vyberte listy, které se zahrnou do jednoho PDF (v pořadí, v jakém jsou v projektu). Karty a texty se vykreslí s vloženým písmem, výkresy jako vektory.</p>
      ${zakladOp ? '<p class="dlg__text">Základní text OP a výpočet SaP se podle metodiky ukládají odděleně od vyjímatelných příloh, např. jako součást posouzení požárního nebezpečí (Hanuška 1996, kap. 2.1) – proto nejsou předem zaškrtnuté. Exportujte je zvlášť.</p>' : ''}
      <div class="moznosti">${p.listy.map((l) => `<label class="moznost"><input type="checkbox" name="l_${l.id}" ${zakladOp && ['op_zaklad', 'op_sap'].includes(l.typ) ? '' : 'checked'}><div><b>${esc(l.nazev)}</b><span>${typy[l.typ] || l.typ}</span></div></label>`).join('')}</div>
      <div class="zprava ${sh.chyby ? 'pozor' : ''}">Kontrola úplnosti: ${sh.chyby} chyb, ${sh.upozorneni} upozornění. PDF se vytvoří i tak; před odevzdáním HZS doplňte chybějící údaje a ověřte měřítko.</div>`,
    ano: 'Vytvořit PDF',
  });
  if (!dlg.ok) return;
  const ids = p.listy.filter((l) => dlg.pole[`l_${l.id}`]).map((l) => l.id);
  if (!ids.length) return oznam('Vyberte alespoň jeden list.');
  try {
    ohlas('Vytvářím PDF…', true);
    const varovani = [], bajty = await exportujPdf(p, { listy: ids, katalog: katMapa, varovani });
    stahniBajty(bajty, jmenoPdf(p.nazev)); ohlas(`PDF je hotové (${Math.round(bajty.length / 1024)} kB).`);
    if (varovani.length) await oznam(varovani.join('\n'), { titul: 'PDF je hotové – upozornění' });
  } catch (err) { ohlas(''); await oznam(`PDF se nepodařilo vytvořit: ${err.message}`); }
}

// ---------- přebírání údajů karta ↔ operativní plán ----------
const TLACITKO_PREVZIT = (odkud) => `<div class="prevzit-lista"><button type="button" class="btn" data-akce-prevzeti="1">${ikona('kopie', 16)}Převzít údaje ${odkud}…</button></div>`;
function obal(host, akce) { const puv = host.onclick; host.onclick = (e) => { if (e.target.closest('[data-akce-prevzeti]')) { akce(); return; } puv?.(e); }; }

// Zdroje: listy daného typu v tomto projektu a v ostatních projektech DZP uložených v prohlížeči.
function zdroje(typ) {
  const o = [];
  const z = (p, vlastni) => p.listy.filter((l) => l.typ === typ).forEach((l) => o.push({ klic: `${p.id}|${l.id}`, nazev: vlastni ? `${l.nazev} (tento projekt)` : `${p.nazev} – ${l.nazev}`, p, l }));
  z(S.p, true);
  for (const m of U.seznam()) { if (m.id === S.p.id || m.typ === 'evakuacni_plan') continue; const p = U.nacti(m.id); if (p) z(p, false); }
  return o;
}
const vyberZdroje = (zd) => `<label class="rk-field"><span class="rk-field__label">Zdroj</span><select class="rk-field__control" name="zdroj">${zd.map((x) => `<option value="${esc(x.klic)}">${esc(x.nazev)}</option>`).join('')}</select></label>`;
const zkrat = (v) => { const t = typeof v === 'boolean' ? (v ? 'ano' : 'ne') : v && typeof v === 'object' ? String(v.popis ?? v.text ?? Object.values(v).filter((x) => typeof x === 'string' && x.trim()).join(' | ')) : String(v ?? ''); return t.length > 160 ? `${t.slice(0, 160)}…` : t; };

async function potvrdNavrh(navrh, titul, uvod = '') {
  if (!navrh.length) { await oznam('Ve zdroji nejsou žádné nové údaje k převzetí (prázdná pole se nepřebírají, shodné hodnoty se přeskočí).', { titul }); return null; }
  const r = await formular({ titul, ano: 'Převzít vybrané',
    html: `${uvod}<p class="dlg__text">Zaškrtnuté údaje se zapíšou do formuláře. Pole, která už mají hodnotu, a údaje k ověření jsou předem odškrtnuté – zaškrtnutím je převezmete.</p>
      <div class="moznosti">${navrh.map((x, i) => `<label class="moznost"><input type="checkbox" name="n_${i}" ${x.stavajici || x.neoznacit ? '' : 'checked'}><div><b>${esc(x.popis)}</b><span>${esc(zkrat(x.nahled ?? x.hodnota))}</span>${x.stavajici ? `<span class="varuj">Přepíše: ${esc(zkrat(x.stavajici))}</span>` : ''}${x.zdroj ? `<small class="citace">${esc(x.zdroj)}</small>` : ''}</div></label>`).join('')}</div>` });
  if (!r.ok) return null;
  return new Set(navrh.map((_, i) => i).filter((i) => r.pole[`n_${i}`]));
}

// PBŘ a projektová dokumentace (PDF s textem, naskenované PDF přes OCR, DOCX) → návrh údajů pro kartu, přílohu OP a poznámky k ověření.
// Vše s citací (soubor, strana), zápis až po potvrzení.
async function nactiPbr(soubory) {
  const titul = 'Údaje z PBŘ a dokumentace', vysledky = [], chyby = [];
  const p = S.p;   // čtení (OCR) trvá – mezitím může uživatel přepnout projekt; zapisuje se vždy do projektu, kde import začal
  const ulozP = () => { if (S.p === p) uloz(true); else { p.zmeneno = new Date().toISOString(); return U.uloz(p); } };
  for (const soubor of soubory) {
    let doc = null;
    try {
      const bajty = new Uint8Array(await soubor.arrayBuffer());
      if (/\.docx$/i.test(soubor.name)) { ohlas(`Čtu ${soubor.name}…`, true); vysledky.push({ soubor: soubor.name, ...rozborPbr(await stranyZDocx(bajty), { odstavce: true }) }); continue; }
      if (/\.doc$/i.test(soubor.name)) { chyby.push(`${soubor.name}: starý formát Word (.doc) aplikace nečte – uložte ho ve Wordu jako .docx nebo PDF.`); continue; }
      ohlas(`Čtu ${soubor.name}…`, true);
      doc = await otevriPdf(bajty);
      let stranky = await radkyZPdf(doc), jistoty = null;
      if (stranky.flat().join('').replace(/\s/g, '').length < 300) {
        ohlas('');
        if (!(await potvrd(`„${soubor.name}“ je naskenované – nemá textovou vrstvu.`, { ano: 'Rozpoznat text (OCR)', popis: `Text se rozpozná přímo v prohlížeči (nic se neodesílá). Trvá to zhruba 3–5 s na stranu (${doc.numPages} str.). Rozpoznaný text může obsahovat chyby – údaje proto pečlivě zkontrolujte s citací.` }))) continue;
        const r = await ocrPdf(doc, { prubeh: (t) => ohlas(t, true) }); stranky = r.stranky; jistoty = r.jistoty;
      }
      const v = rozborPbr(stranky, /pbr|pbř/i.test(soubor.name) ? { jePbr: true } : {});
      // OCR: jistota strany, ze které údaj pochází; pod 75 % se nic předem nezaškrtne (čísla mohou být přečtená špatně)
      if (jistoty) v.nalezy.forEach((n) => { n.ocr = jistoty[(n.strana || 1) - 1] ?? null; if (n.ocr !== null && n.ocr < 75) n.neoznacit = true; });
      vysledky.push({ soubor: soubor.name, jistoty, ...v });
    } catch (err) { console.error(err); chyby.push(`${soubor.name}: ${err?.message || String(err)}`); }
    finally { try { await doc?.destroy(); } catch { /* uvolnění workeru pdf.js */ } }
  }
  ohlas('');
  if (!vysledky.length) { if (chyby.length) await oznam(chyby.join('\n'), { titul }); return 0; }
  const { nalezy, nenalezeno } = slucRozbory(vysledky);
  const cile = { karta: p.listy.find((l) => l.typ === 'karta')?.karta, opText: p.listy.find((l) => l.typ === 'op_text')?.opText, opZaklad: p.listy.find((l) => l.typ === 'op_zaklad')?.opZaklad, projekt: p };
  p.dotaznik.pbr = { soubor: vysledky.map((v) => v.soubor).join(', '), datum: new Date().toLocaleString('cs-CZ'), nalezeno: nalezy.map((n) => n.popis.split(' – ')[0]), nenalezeno };
  await ulozP();
  const navrh = navrhZPbr(nalezy, cile);
  const ocrInfo = vysledky.filter((v) => v.jistoty).map((v) => `${v.soubor} – rozpoznáno OCR, jistota po stranách ${Math.min(...v.jistoty)}–${Math.max(...v.jistoty)} % (údaje ze stran pod 75 % nejsou předem zaškrtnuté)`);
  const uvod = `<p class="dlg__text">Nalezeno: ${udaju(nalezy.length)} v ${vysledky.length} ${vysledky.length === 1 ? 'dokumentu' : 'dokumentech'}. Čteno podle typických formulací – u každého údaje je citace a strana, zkontrolujte je. PBŘ popisuje stav <b>podle projektu</b>, skutečnost ověřte na místě.</p>${ocrInfo.length ? `<p class="dlg__text">${esc(ocrInfo.join('; '))}.</p>` : ''}${chyby.length ? `<p class="dlg__text varuj">Nenačteno: ${esc(chyby.join(' '))}</p>` : ''}${nenalezeno.length ? `<p class="dlg__text"><b>V dokumentech nezjištěno</b> (zeptejte se klienta – dotazník): ${esc(nenalezeno.join(', '))}.</p>` : ''}`;
  const vyb = await potvrdNavrh(navrh, `${titul}${S.p === p ? '' : ` → projekt „${p.nazev}“`}`, uvod);
  if (!vyb) return 0;
  const n = pouzijNavrh(navrh, vyb, cile); await ulozP();
  if (S.p !== p) { ohlas(`Převzato: ${udaju(n)} do projektu „${p.nazev}“ (import začal v něm, mezitím jste přepnuli).`); return 0; }
  panel(true); ohlas(`Převzato: ${udaju(n)} z dokumentace.${cile.karta || cile.opText ? '' : ' Projekt nemá operativní kartu ani plán – převzaty jen poznámky.'}`); return n;
}
const TLACITKO_PBR = `<label class="btn" title="PBŘ, průvodní a souhrnná zpráva – PDF (i naskenované, OCR) nebo Word .docx; lze vybrat více souborů najednou. Údaje se zapíšou až po potvrzení.">${ikona('import', 16)}Načíst údaje z PBŘ / dokumentace…<input type="file" class="sr-only" multiple accept="application/pdf,.pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-pbr="1"></label>`;
const pripojPbr = (host, poKonci) => host.querySelector('[data-pbr]')?.addEventListener('change', (e) => { e.stopPropagation(); const f = [...e.target.files]; e.target.value = ''; if (f.length) nactiPbr(f).then((n) => n && poKonci()); });

async function prevzitDoPlanu() {
  const zd = zdroje('karta'), titul = 'Převzít z operativní karty';
  if (!zd.length) { await oznam('V tomto prohlížeči není žádná operativní karta (v tomto ani jiném projektu DZP).', { titul }); return 0; }
  const r = await formular({ titul, ano: 'Pokračovat', html: `<p class="dlg__text">Údaje karty se převedou do textové části přílohy a základního textu OP. Nebezpečí, vodní zdroje a PBZ se převedou jako text.</p>${vyberZdroje(zd)}` });
  if (!r.ok) return 0;
  const src = zd.find((x) => x.klic === r.pole.zdroj), cile = { opText: S.p.listy.find((l) => l.typ === 'op_text')?.opText, opZaklad: S.p.listy.find((l) => l.typ === 'op_zaklad')?.opZaklad };
  const navrh = navrhZKarty(src.l.karta, cile), vyb = await potvrdNavrh(navrh, titul);
  if (!vyb) return 0;
  const n = pouzijNavrh(navrh, vyb, cile); uloz(true); ohlas(`Převzato: ${udaju(n)} z karty „${src.l.nazev}“.`); return n;
}

async function prevzitDoKarty(list) {
  const zd = zdroje('op_text'), titul = 'Převzít z operativního plánu';
  if (!zd.length) { await oznam('V tomto prohlížeči není žádný operativní plán s textovou částí přílohy.', { titul }); return 0; }
  const r = await formular({ titul, ano: 'Pokračovat', html: `<p class="dlg__text">Do karty se převezmou jen jednoznačná pole: údaje vybrané budovy, obsazení osobami, doporučení pro velitele a stupeň poplachu. Nebezpečí, vodní zdroje a PBZ jsou v kartě strukturované – z textu plánu je nelze spolehlivě rozložit, doplňte je ručně.</p>${vyberZdroje(zd)}` });
  if (!r.ok) return 0;
  const src = zd.find((x) => x.klic === r.pole.zdroj), opText = src.l.opText, opZaklad = src.p.listy.find((l) => l.typ === 'op_zaklad')?.opZaklad;
  let budova = opText.objekty[0] || null;
  if (opText.objekty.length > 1) {
    const b = await formular({ titul, ano: 'Pokračovat', html: `<label class="rk-field"><span class="rk-field__label">Budova, pro kterou je karta</span><select class="rk-field__control" name="budova">${opText.objekty.map((o) => `<option value="${esc(o.id)}">${esc(o.nazev || '(bez názvu)')}</option>`).join('')}</select></label>` });
    if (!b.ok) return 0; budova = opText.objekty.find((o) => o.id === b.pole.budova);
  }
  const navrh = navrhZPlanu({ opText, opZaklad }, budova, list.karta), vyb = await potvrdNavrh(navrh, titul);
  if (!vyb) return 0;
  const n = pouzijNavrh(navrh, vyb, { karta: list.karta }); uloz(true); ohlas(`Převzato: ${udaju(n)} z plánu „${src.p.nazev}“.`); return n;
}

// ---------- editor ----------
const OP_LISTY = {   // typ listu → [klíč dat, schéma, nadpis náhledu, poznámka, úvod formuláře]
  op_zaklad: ['opZaklad', SCHEMA_ZAKLAD, 'OPERATIVNÍ PLÁN – základní text', 'Podle Metodického návodu k vypracování DZP (Hanuška 1996), kap. 2.1 a příloha č. 3.', '<p class="napoveda">Základní text je koncept a podklad pro vyjímatelné přílohy; zpracovává se v jednom vyhotovení a ukládá se odděleně od příloh (Hanuška 1996, kap. 2.1).</p>'],
  op_text: ['opText', SCHEMA_TEXT, 'OPERATIVNÍ PLÁN – vyjímatelná příloha, textová část', 'Podle Metodického návodu k vypracování DZP (Hanuška 1996), kap. 2.2 a příloha č. 3.', '<p class="napoveda">Co nejstručněji, heslovitě – jen údaje, které nejde zakreslit do grafické části (Hanuška 1996, kap. 2.2).</p>'],
};
const PANELY = { vlastnosti: 'Vlastnosti', vrstvy: 'Vrstvy', uplnost: 'Úplnost', metodika: 'Metodika', projekt: 'Projekt' };
const panelyListu = (list) => (list && VYKRES.includes(list.typ) ? ['vlastnosti', 'vrstvy', 'uplnost', 'metodika', 'projekt'] : ['uplnost', 'metodika', 'projekt']);

function editor() {
  S.ed?.zrusit(); S.ed = null;
  { const r = rezimProjektu(S.p.typ); nastavLogo(r); try { localStorage.setItem('pp-rezim', r); } catch { /* bez úložiště */ } }
  const p = S.p, list = S.listId === 'dotaznik' ? { id: 'dotaznik', typ: 'dotaznik', nazev: 'Dotazník pro klienta', virtualni: true } : p.listy.find((l) => l.id === S.listId);
  const dostupne = panelyListu(list); if (!dostupne.includes(S.panel)) S.panel = dostupne[0];
  topAkce.innerHTML = `<span class="nazev-projektu">${esc(p.nazev)}</span>${M.jeEvakuace(p) ? '<span class="rk-badge rk-badge--warning" title="Evakuační plán není DZP">Evakuační plán · ne DZP</span>' : ''}<span id="stav" class="stav">${esc(S.stav)}</span>
    ${list?.typ === 'karta' ? `<button class="btn" id="a-tisk" title="Vytiskne náhled karty; v dialogu zvolte Uložit jako PDF" aria-label="Tisk / PDF">${ikona('tisk', 16)}<span class="btn__txt">Tisk / PDF</span></button>` : ''}
    <button class="btn" id="a-pdf" title="Vytvoří PDF z karet, výkresů a textů projektu" aria-label="Export PDF">${ikona('soubor', 16)}<span class="btn__txt">Export PDF</span></button>
    <button class="btn" id="a-stahnout" title="Záloha projektu jako soubor .pplan.json (Stáhnout → Editovatelný projekt)" aria-label="Stáhnout → Editovatelný projekt">${ikona('stahnout', 16)}<span class="btn__txt">Stáhnout → Editovatelný projekt</span></button>`;
  $('#a-stahnout').onclick = () => U.stahni(p);
  $('#a-pdf').onclick = () => exportPdfDialog();
  if ($('#a-tisk')) $('#a-tisk').onclick = async () => { S.zalozka = 'nahled'; obsah(list); zalozky(list); await pismoKarty; prizpusobNahled($('#obsah')); window.print(); };

  app.innerHTML = `<div class="editor ${list && VYKRES.includes(list.typ) ? 'editor-vykres' : ''}">
    <nav class="listy" aria-label="Listy dokumentace"><h2>Listy</h2><ol id="listy">${p.listy.map((l) => `<li class="${l.id === S.listId ? 'akt' : ''}"><a href="#/p/${esc(p.id)}/${esc(l.id)}">${esc(l.nazev)}<small>${esc(M.TYPY_LISTU_NAZVY[l.typ] || l.typ)}</small></a></li>`).join('')}</ol>
      ${M.jeEvakuace(p) ? '' : `<ol class="listy-extra"><li class="${S.listId === 'dotaznik' ? 'akt' : ''}"><a href="#/p/${esc(p.id)}/dotaznik" id="l-dotaznik">Dotazník pro klienta<small>sběr údajů od klienta</small></a></li></ol>`}
      <details class="listy-sprava" ${window.innerWidth > 1100 ? 'open' : ''}><summary>Správa listů</summary><div class="listy-akce"><select id="l-typ" aria-label="Typ nového listu">${(M.LISTY_PRO_DOKUMENT[p.typ] || M.TYPY_LISTU).map((t) => `<option value="${t}">${M.TYPY_LISTU_NAZVY[t]}</option>`).join('')}</select><button class="btn mal" id="l-pridej">${ikona('plus', 14)}List</button>
      ${list && !list.virtualni ? `<button class="btn mal" id="l-prejm">Přejmenovat</button><button class="btn mal" id="l-kopie">Kopie</button><button class="btn mal" id="l-nahoru" title="Posunout nahoru" aria-label="Posunout nahoru">${ikona('nahoru', 14)}</button><button class="btn mal" id="l-dolu" title="Posunout dolů" aria-label="Posunout dolů">${ikona('dolu', 14)}</button><button class="btn mal nebezp" id="l-smaz">Smazat</button>` : ''}</div></details></nav>
    <section class="stred">
      <div class="zalozky" id="zalozky-formular" role="tablist"></div>
      <div id="obsah"></div></section>
    <aside class="panel"><div class="zalozky" id="zalozky-panel" role="tablist">${dostupne.map((k) => `<button role="tab" data-p="${k}" class="${S.panel === k ? 'akt' : ''}">${PANELY[k]}</button>`).join('')}</div><div id="panel-obsah"></div></aside>
  </div>`;

  $('#l-pridej').onclick = async () => { const typ = $('#l-typ').value, n = await zeptejSe('Název nového listu', M.TYPY_LISTU_NAZVY[typ] || typ); if (n === null) return; const l = M.pridejList(p, typ, n.trim() || undefined); uloz(true); location.hash = `#/p/${p.id}/${l.id}`; };
  if (list && !list.virtualni) {
    $('#l-prejm').onclick = async () => { const n = await zeptejSe('Nový název listu', list.nazev); if (n?.trim()) { M.prejmenujList(p, list.id, n.trim()); uloz(true); editor(); } };
    $('#l-kopie').onclick = () => { const k = M.kopirujList(p, list.id); uloz(true); location.hash = `#/p/${p.id}/${k.id}`; };
    $('#l-nahoru').onclick = () => { M.presunList(p, list.id, list.poradi - 1); uloz(true); editor(); };
    $('#l-dolu').onclick = () => { M.presunList(p, list.id, list.poradi + 1); uloz(true); editor(); };
    $('#l-smaz').onclick = async () => { if (await potvrd(`Smazat list „${list.nazev}“?`, { ano: 'Smazat', nebezpecne: true })) { M.smazList(p, list.id); M.uklidPrilohy(p); uloz(true); jdi(`#/p/${p.id}`); } };
  }
  // přepnutí záložek nepřekresluje editor (zachová pohled, výběr a historii)
  app.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { S.panel = b.dataset.p; app.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('akt', x === b)); panel(); }; });
  zalozky(list); obsah(list); panel();
}

function zalozky(list) {
  const host = $('#zalozky-formular'); if (!host) return;
  if (!['karta', 'evak_text', 'op_zaklad', 'op_text', 'op_sap', 'dotaznik'].includes(list?.typ)) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = `<button role="tab" data-z="formular" class="${S.zalozka === 'formular' ? 'akt' : ''}">Formulář</button><button role="tab" data-z="nahled" class="${S.zalozka === 'nahled' ? 'akt' : ''}">Náhled A4</button>`;
  host.querySelectorAll('[data-z]').forEach((b) => { b.onclick = () => { S.zalozka = b.dataset.z; zalozky(list); obsah(list); panel(); }; });
}

function obsah(list) {
  const host = $('#obsah');
  if (!list) { host.innerHTML = '<p class="prazdno">Projekt nemá žádný list. Přidejte ho vlevo.</p>'; return; }
  if (list.typ === 'karta') {
    if (S.zalozka === 'nahled') { host.innerHTML = `<div id="nahled-a4">${nahledKarty(list, S.p)}</div>`; prizpusobNahled(host); pismoKarty.then(() => { if (host.isConnected) prizpusobNahled(host); }); return; }
    const kresli = () => { vykresliKartu(list, host); host.insertAdjacentHTML('afterbegin', TLACITKO_PREVZIT('z operativního plánu')); host.querySelector('.prevzit-lista').insertAdjacentHTML('beforeend', TLACITKO_PBR); pripoj(list, host, naZmenu); pripojPbr(host, kresli); obal(host, () => prevzitDoKarty(list).then((n) => n && kresli())); panel(true); };
    const naZmenu = (prekreslit) => {
      uloz();
      if (prekreslit) { const y = window.scrollY; kresli(); window.scrollTo(0, y); } else panel(true);
    };
    kresli();
  } else if (list.typ === 'dotaznik') {
    const objekt = () => S.p.listy.find((l) => l.karta)?.karta.objekt.nazev || S.p.listy.find((l) => l.opText)?.opText.objekty[0]?.nazev || S.p.nazev;
    if (S.zalozka === 'nahled') { host.innerHTML = `<div id="nahled-a4">${nahledSchema('DOTAZNÍK PRO KLIENTA', 'Odpovědi klienta; do karty a plánu je přenesete tlačítkem „Převzít odpovědi do projektu“.', dotaznikJakoText(S.p.dotaznik, objekt()))}</div>`; return; }
    const kresli = () => { vykresliDotaznik(S.p, host, TLACITKO_PBR); pripojPbr(host, kresli); };
    kresli();
    pripojDotaznik(S.p, host, {
      onZmena: () => uloz(),
      stahniPdf: async () => { try { ohlas('Vytvářím PDF dotazníku…', true); const b = await dotaznikDoPdf(S.p.dotaznik, { objekt: objekt() }); stahniBajty(b, jmenoPdf(`Dotaznik_DZP_${objekt()}`)); ohlas('Dotazník je stažený – pošlete ho klientovi k vyplnění.'); } catch (err) { ohlas(''); oznam(`PDF dotazníku se nepodařilo vytvořit: ${err.message}`); } },
      nactiPdf: async (soubor) => {
        try {
          const r = await dotaznikZPdf(new Uint8Array(await soubor.arrayBuffer())), n = Object.keys(r.odpovedi).length;
          const prepis = Object.keys(r.odpovedi).filter((k) => S.p.dotaznik.odpovedi[k] !== undefined && String(S.p.dotaznik.odpovedi[k]) !== String(r.odpovedi[k])).length;
          if (prepis && !(await potvrd(`Načíst z PDF: ${odpovedi(n)}?`, { ano: 'Načíst', popis: `Už vyplněné odpovědi se přepíší hodnotou z PDF (${prepis}). Odpovědi, které PDF neobsahuje, zůstanou.` }))) return;
          Object.assign(S.p.dotaznik.odpovedi, r.odpovedi); S.p.dotaznik.nacteno = new Date().toLocaleString('cs-CZ'); uloz(true); kresli();
          const zText = Object.entries(r.puvodni).map(([id, t]) => `• ${OTAZKY.find((q) => q.id === id)?.text}: „${t}“ → ${String(r.odpovedi[id]).replace('.', ',')}`);
          if (r.nectene.length || zText.length) await oznam([`Načteno: ${odpovedi(n)}.`, ...(r.nectene.length ? ['', 'Číslo nešlo jednoznačně přečíst – doplňte ručně:', ...r.nectene.map((x) => `• ${x}`)] : []), ...(zText.length ? ['', 'Číslo přečtené z textu – zkontrolujte:', ...zText] : [])].join('\n'), { titul: 'Vyplněný dotazník' });
          else ohlas(`Načteno: ${odpovedi(n)} z vyplněného dotazníku.`);
        } catch (err) { oznam(`Dotazník se nepodařilo načíst: ${err.message}`); }
      },
      prevzit: async () => {
        const titul = 'Převzít odpovědi do projektu', cile = { karta: S.p.listy.find((l) => l.typ === 'karta')?.karta, opText: S.p.listy.find((l) => l.typ === 'op_text')?.opText, opZaklad: S.p.listy.find((l) => l.typ === 'op_zaklad')?.opZaklad, projekt: S.p };
        const navrh = navrhZDotazniku(S.p.dotaznik.odpovedi, cile), vyb = await potvrdNavrh(navrh, titul);
        if (!vyb) return;
        const n = pouzijNavrh(navrh, vyb, cile); uloz(true); panel(true); ohlas(`Převzato: ${udaju(n)} z dotazníku.${cile.karta ? '' : ' Projekt nemá operativní kartu – údaje karty se nepřevzaly.'}`);
      },
    });
  } else if (list.typ === 'op_sap') {
    nastavKontextSaP(list.opSap, kontextSaP(S.p));   // vydatnost vody z ověřeného hydrantu v kartě (když není zadána)
    if (S.zalozka === 'nahled') { host.innerHTML = `<div id="nahled-a4">${nahledSchema('OPERATIVNÍ PLÁN – výpočet SaP', 'Podle Metodického návodu k vypracování DZP (Hanuška 1996), část druhá.', sapJakoText(list.opSap))}</div>`; return; }
    const kresli = () => { vykresliSap(list, host); };
    kresli();
    pripojSap(list, host, {
      onZmena: () => { uloz(); panel(true); },
      prekresli: () => { const y = window.scrollY; kresli(); window.scrollTo(0, y); },
      zapisShrnuti: async (t) => {
        const z = S.p.listy.find((l) => l.typ === 'op_zaklad'); if (!z) return oznam('Projekt nemá základní text OP.');
        if (z.opZaklad.sap.vysledek?.trim() && !(await potvrd('Přepsat výsledek SaP v základním textu?', { ano: 'Přepsat', popis: z.opZaklad.sap.vysledek }))) return;
        z.opZaklad.sap.vysledek = t; if (z.opZaklad.sap.provadi === null) z.opZaklad.sap.provadi = true; uloz(true); panel(true); ohlas('Shrnutí výpočtu SaP zapsáno do základního textu OP.');
      },
    });
  } else if (OP_LISTY[list.typ]) {
    const [klic, schema, nadpis, pozn, uvod] = OP_LISTY[list.typ], data = list[klic], prefix = `listy[${list.id}].${klic}`;
    if (S.zalozka === 'nahled') { host.innerHTML = `<div id="nahled-a4">${nahledSchema(nadpis, pozn, schemaJakoText(data, schema))}</div>`; return; }
    const kresli = () => { vykresliSchema(data, schema, prefix, host, TLACITKO_PREVZIT('z operativní karty') + uvod); host.querySelector('.prevzit-lista').insertAdjacentHTML('beforeend', TLACITKO_PBR); pripojSchema(data, schema, host, naZmenu); pripojPbr(host, kresli); obal(host, () => prevzitDoPlanu().then((n) => n && kresli())); };
    const naZmenu = (prekreslit) => { uloz(); if (prekreslit) { const y = window.scrollY; kresli(); window.scrollTo(0, y); } panel(true); };
    kresli();
  } else if (list.typ === 'evak_text') {
    if (S.zalozka === 'nahled') { host.innerHTML = `<div id="nahled-a4">${nahledEvak(list, S.p)}</div>`; return; }
    const naZmenu = (prekreslit) => { uloz(); if (prekreslit) { const y = window.scrollY; vykresliEvak(list, host); pripojEvak(list, host, naZmenu); window.scrollTo(0, y); } panel(true); };
    vykresliEvak(list, host); pripojEvak(list, host, naZmenu);
  } else if (list.typ === 'text') {
    host.innerHTML = `<label class="f"><span>Text listu „${esc(list.nazev)}“</span><textarea rows="24" id="t-text">${esc(list.text)}</textarea></label>`;
    $('#t-text').oninput = (e) => { list.text = e.target.value; uloz(); };
  } else {
    S.ed = vytvorEditor({
      host, projekt: S.p, list, katalog: katalogProjektu(S.p, katalog),
      naZmenu: () => { uloz(); if (S.panel === 'uplnost') panel(); },
      naVyber: () => { if (S.panel === 'vlastnosti' || S.panel === 'vrstvy') panel(); },
    });
  }
}

function panel(jenUplnost = false) {
  const host = $('#panel-obsah'); if (!host) return;
  host.onclick = host.onchange = host.oninput = null;
  if ((S.panel === 'vlastnosti' || S.panel === 'vrstvy') && S.ed) { vykresliPanelVykresu(S.panel, host, S.ed); return; }
  if (S.panel === 'uplnost') {
    označ(panelUplnosti(S.p, katalog, host));
    host.onclick = (e) => { const b = e.target.closest('[data-cesta]'); if (b) skoc(b.dataset.cesta); };
  } else {
    if (!jenUplnost) {
      if (S.panel === 'metodika') host.innerHTML = M.jeEvakuace(S.p) ? METODIKA_EVAK : METODIKA.replace('<details open>', `${S.p.typ === 'operativni_plan' ? METODIKA_OP : ''}<details open>`);
      if (S.panel === 'projekt') panelProjektu(S.p, host, (prekreslit) => { uloz(true); if (prekreslit) editor(); else $('.nazev-projektu').textContent = S.p.nazev; });
    }
    označ(zkontrolujUplnost(S.p, katalog));
  }
}
function označ(nalezy) {
  document.querySelectorAll('.chybi-pole').forEach((e) => e.classList.remove('chybi-pole'));
  for (const n of nalezy) {
    if (n.hladina !== 'chyba') continue;
    const el = hledej(n.cesta); if (el) el.classList.add('chybi-pole');
  }
}
const hledej = (c) => document.querySelector(`[data-cesta="${CSS.escape(c)}"]`) || document.querySelector(`[data-cesta^="${CSS.escape(c)}."]`);
function skoc(cesta) {
  const jiny = /^listy\[([^\]]+)\]\.(?!vykres)/.exec(cesta);   // nález k poli jiného textového listu: otevřít ten list
  if (jiny && jiny[1] !== S.listId && S.p.listy.some((l) => l.id === jiny[1])) { S.zalozka = 'formular'; location.hash = `#/p/${S.p.id}/${jiny[1]}`; return; }
  const m = /^listy\[([^\]]+)\]\.vykres/.exec(cesta);
  if (m) {   // nález k výkresu: otevřít list a panel Vlastnosti
    if (S.listId !== m[1]) { S.panel = 'vlastnosti'; location.hash = `#/p/${S.p.id}/${m[1]}`; return; }
    if (S.ed) { S.ed.nastavVyber([]); S.panel = 'vlastnosti'; app.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('akt', x.dataset.p === 'vlastnosti')); panel(); }
    return;
  }
  if (S.zalozka !== 'formular') { S.zalozka = 'formular'; const l = S.p.listy.find((x) => x.id === S.listId); zalozky(l); obsah(l); }
  const el = hledej(cesta); if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  (el.matches('input,select,textarea') ? el : el.querySelector('input,select,textarea,button'))?.focus({ preventScroll: true });
}

// Písmo náhledu karty = písmo PDF (Roboto), aby se karta v náhledu zalomila stejně jako v PDF. Bez něj se použije Arial.
const pismoKarty = (async () => {
  try { const f = await nactiFonty(); for (const [b, vaha] of [[f.regular, '400'], [f.bold, '700']]) { const ff = new FontFace('RobotoKarta', b, { weight: vaha }); await ff.load(); document.fonts.add(ff); } } catch { /* záložní písmo */ }
})();

// ---------- start ----------
Promise.all([U.init(), nactiKatalog().then((k) => { katalog = k; }).catch((e) => ohlas(`Katalog značek se nenačetl: ${e.message}`, true))]).finally(smeruj);
