import * as M from './model.js';
import * as U from './ulozeni.js';
import { nactiKatalog } from './znacky.js';
import { vykresliKartu, pripoj, esc } from './formular.js';
import { nahledKarty } from './nahled.js';
import { panelUplnosti, panelProjektu, METODIKA } from './panely.js';
import { zkontrolujUplnost } from './uplnost.js';
import { vytvorEditor } from './kresleni/editor.js';
import { vykresliPanelVykresu } from './kresleni/panel-vykres.js';
import { nactiObrazek, vlozPodklad } from './kresleni/podklad.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), topAkce = $('#top-akce'), hlaska = $('#hlaska');
let katalog = [];
const S = { p: null, listId: null, zalozka: 'formular', panel: 'uplnost', stav: '', ed: null };
const VYKRES = ['situace', 'pudorys', 'schema'];

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
    S.listId = (listId && S.p.listy.some((l) => l.id === listId)) ? listId : S.p.listy[0]?.id ?? null;
    U.nastavPosledni(id);
    editor();
  } else { S.p = null; dashboard(); }
}
window.addEventListener('hashchange', smeruj);

// ---------- dashboard ----------
function dashboard() {
  S.ed?.zrusit(); S.ed = null;
  topAkce.innerHTML = '';
  const sez = U.seznam(), posl = U.posledni();
  const poslProj = sez.find((x) => x.id === posl);
  app.innerHTML = `<section class="dash">
    <h1>Dokumentace zdolávání požárů</h1>
    ${U.dostupne() ? '' : '<p class="varovani">Úložiště prohlížeče není dostupné (soukromé okno nebo zablokovaná data). Projekt se neuloží – po úpravách použijte Stáhnout → Editovatelný projekt.</p>'}
    <div class="dlazdice">
      ${poslProj ? `<a class="dlazdice-polozka hlavni" href="#/p/${poslProj.id}" id="d-pokracovat"><b>Pokračovat v projektu</b><span>${esc(poslProj.nazev)}</span><small>upraveno ${new Date(poslProj.zmeneno).toLocaleString('cs-CZ')}</small></a>` : ''}
      <form class="dlazdice-polozka" id="d-novy"><b>Založit nový plán</b>
        <input type="text" name="nazev" placeholder="Název (např. DZP Litice)" required>
        <select name="typ"><option value="operativni_karta">Operativní karta</option><option value="operativni_plan">Operativní plán (zatím bez listů)</option></select>
        <button class="btn pri">Založit</button></form>
      <div class="dlazdice-polozka"><b>Importovat projekt</b><span>Soubor .pplan.json ze zálohy.</span>
        <label class="btn">Vybrat soubor…<input type="file" id="d-import" accept=".json,application/json" hidden></label></div>
      <div class="dlazdice-polozka"><b>Importovat podklad</b><span>Obrázek PNG/JPG (situace, plánek) – založí nový plán s podkladem.</span>
        <label class="btn">Vybrat obrázek…<input type="file" id="d-podklad" accept="image/png,image/jpeg" hidden></label></div>
      <div class="dlazdice-polozka"><b>Referenční projekt Litice</b><span>Jen potvrzené údaje o FVE a poznámky; ostatní pole prázdná.</span><button class="btn" id="d-litice">Založit z Litic</button></div>
    </div>
    <h2>Uložené projekty</h2>
    <ul class="projekty">${sez.map((x) => `<li><a href="#/p/${x.id}"><b>${esc(x.nazev)}</b><small>${x.typ === 'operativni_karta' ? 'operativní karta' : 'operativní plán'} · ${new Date(x.zmeneno).toLocaleString('cs-CZ')}</small></a>
      <button class="btn mal" data-akce="kopie" data-id="${x.id}">Duplikovat</button><button class="btn mal" data-akce="stahnout" data-id="${x.id}">Stáhnout</button><button class="btn mal nebezp" data-akce="smaz" data-id="${x.id}">Smazat</button></li>`).join('') || '<li class="prazdno">Zatím žádný uložený projekt.</li>'}</ul>
    <p class="napoveda">Projekty jsou uloženy lokálně v tomto prohlížeči a automaticky se nesynchronizují s webovou verzí ani jinými zařízeními. Zálohujte přes Stáhnout.</p>
  </section>`;
  $('#d-novy').onsubmit = (e) => {
    e.preventDefault(); const d = new FormData(e.target);
    const p = M.novyProjekt({ nazev: d.get('nazev').trim(), typ: d.get('typ') });
    U.uloz(p); location.hash = `#/p/${p.id}`;
  };
  $('#d-import').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const p = M.nactiProjekt(await f.text());
      if (U.seznam().some((x) => x.id === p.id)) { p.id = `proj_${Math.random().toString(36).slice(2, 10)}`; p.nazev += ' (import)'; }
      const r = await U.uloz(p); if (!r.ok) throw new Error(r.chyba);
      location.hash = `#/p/${p.id}`;
    } catch (err) { ohlas(`Import selhal: ${err.message}`); }
  };
  $('#d-podklad').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const ob = await nactiObrazek(f), p = M.novyProjekt({ nazev: f.name.replace(/\.[^.]+$/, ''), typ: 'operativni_karta' });
      vlozPodklad(p, p.listy.find((l) => l.typ === 'situace').vykres, ob);
      const r = await U.uloz(p); if (!r.ok) throw new Error(r.chyba);
      location.hash = `#/p/${p.id}/${p.listy.find((l) => l.typ === 'situace').id}`;
    } catch (err) { ohlas(`Import podkladu selhal: ${err.message}`); }
  };
  $('#d-litice').onclick = async () => {
    try {
      const r = await fetch('data/litice.projekt.json'); if (!r.ok) throw new Error('soubor nenalezen');
      const p = M.nactiProjekt(await r.text()); p.id = `proj_${Math.random().toString(36).slice(2, 10)}`;
      U.uloz(p); location.hash = `#/p/${p.id}`;
    } catch (err) { ohlas(`Referenční projekt se nepodařilo načíst (${err.message}). Aplikaci je potřeba spustit přes webový server, ne z file://.`); }
  };
  app.querySelector('.projekty').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.id, p = U.nacti(id);
    if (b.dataset.akce === 'smaz' && confirm(`Smazat projekt „${p.nazev}“ z tohoto prohlížeče? Nelze vrátit – nejdřív si ho případně stáhněte.`)) { U.smaz(id); dashboard(); }
    if (b.dataset.akce === 'stahnout') U.stahni(p);
    if (b.dataset.akce === 'kopie') { p.id = `proj_${Math.random().toString(36).slice(2, 10)}`; p.nazev += ' (kopie)'; U.uloz(p); dashboard(); }
  };
}

// ---------- editor ----------
const PANELY = { vlastnosti: 'Vlastnosti', vrstvy: 'Vrstvy', uplnost: 'Úplnost', metodika: 'Metodika DZP', projekt: 'Projekt' };
const panelyListu = (list) => (list && VYKRES.includes(list.typ) ? ['vlastnosti', 'vrstvy', 'uplnost', 'metodika', 'projekt'] : ['uplnost', 'metodika', 'projekt']);

function editor() {
  S.ed?.zrusit(); S.ed = null;
  const p = S.p, list = p.listy.find((l) => l.id === S.listId);
  const dostupne = panelyListu(list); if (!dostupne.includes(S.panel)) S.panel = dostupne[0];
  topAkce.innerHTML = `<span class="nazev-projektu">${esc(p.nazev)}</span><span id="stav" class="stav">${esc(S.stav)}</span>
    ${list?.typ === 'karta' ? '<button class="btn" id="a-tisk" title="Vytiskne náhled karty; v dialogu zvolte Uložit jako PDF">Tisk / PDF</button>' : ''}
    <button class="btn" id="a-stahnout" title="Záloha projektu jako soubor .pplan.json">Stáhnout → Editovatelný projekt</button>`;
  $('#a-stahnout').onclick = () => U.stahni(p);
  if ($('#a-tisk')) $('#a-tisk').onclick = () => { S.zalozka = 'nahled'; obsah(list); zalozky(list); window.print(); };

  app.innerHTML = `<div class="editor ${list && VYKRES.includes(list.typ) ? 'editor-vykres' : ''}">
    <nav class="listy" aria-label="Listy dokumentace"><h2>Listy</h2><ol id="listy">${p.listy.map((l) => `<li class="${l.id === S.listId ? 'akt' : ''}"><a href="#/p/${p.id}/${l.id}">${esc(l.nazev)}<small>${l.typ}</small></a></li>`).join('')}</ol>
      <details class="listy-sprava" ${window.innerWidth > 1100 ? 'open' : ''}><summary>Správa listů</summary><div class="listy-akce"><select id="l-typ" aria-label="Typ nového listu">${M.TYPY_LISTU.map((t) => `<option>${t}</option>`).join('')}</select><button class="btn mal" id="l-pridej">+ List</button>
      ${list ? `<button class="btn mal" id="l-prejm">Přejmenovat</button><button class="btn mal" id="l-kopie">Kopie</button><button class="btn mal" id="l-nahoru" title="Posunout nahoru">↑</button><button class="btn mal" id="l-dolu" title="Posunout dolů">↓</button><button class="btn mal nebezp" id="l-smaz">Smazat</button>` : ''}</div></details></nav>
    <section class="stred">
      <div class="zalozky" id="zalozky-formular" role="tablist"></div>
      <div id="obsah"></div></section>
    <aside class="panel"><div class="zalozky" id="zalozky-panel" role="tablist">${dostupne.map((k) => `<button role="tab" data-p="${k}" class="${S.panel === k ? 'akt' : ''}">${PANELY[k]}</button>`).join('')}</div><div id="panel-obsah"></div></aside>
  </div>`;

  $('#l-pridej').onclick = () => { const l = M.pridejList(p, $('#l-typ').value, prompt('Název listu:') || undefined); uloz(true); location.hash = `#/p/${p.id}/${l.id}`; };
  if (list) {
    $('#l-prejm').onclick = () => { const n = prompt('Nový název listu:', list.nazev); if (n) { M.prejmenujList(p, list.id, n); uloz(true); editor(); } };
    $('#l-kopie').onclick = () => { const k = M.kopirujList(p, list.id); uloz(true); location.hash = `#/p/${p.id}/${k.id}`; };
    $('#l-nahoru').onclick = () => { M.presunList(p, list.id, list.poradi - 1); uloz(true); editor(); };
    $('#l-dolu').onclick = () => { M.presunList(p, list.id, list.poradi + 1); uloz(true); editor(); };
    $('#l-smaz').onclick = () => { if (confirm(`Smazat list „${list.nazev}“?`)) { M.smazList(p, list.id); M.uklidPrilohy(p); uloz(true); location.hash = `#/p/${p.id}`; } };
  }
  // přepnutí záložek nepřekresluje editor (zachová pohled, výběr a historii)
  app.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { S.panel = b.dataset.p; app.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('akt', x === b)); panel(); }; });
  zalozky(list); obsah(list); panel();
}

function zalozky(list) {
  const host = $('#zalozky-formular'); if (!host) return;
  if (list?.typ !== 'karta') { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = `<button role="tab" data-z="formular" class="${S.zalozka === 'formular' ? 'akt' : ''}">Formulář</button><button role="tab" data-z="nahled" class="${S.zalozka === 'nahled' ? 'akt' : ''}">Náhled A4</button>`;
  host.querySelectorAll('[data-z]').forEach((b) => { b.onclick = () => { S.zalozka = b.dataset.z; zalozky(list); obsah(list); panel(); }; });
}

function obsah(list) {
  const host = $('#obsah');
  if (!list) { host.innerHTML = '<p class="prazdno">Projekt nemá žádný list. Přidejte ho vlevo.</p>'; return; }
  if (list.typ === 'karta') {
    if (S.zalozka === 'nahled') { host.innerHTML = `<div id="nahled-a4">${nahledKarty(list, S.p)}</div>`; return; }
    const kresli = () => { vykresliKartu(list, host); pripoj(list, host, naZmenu); panel(true); };
    const naZmenu = (prekreslit) => {
      uloz();
      if (prekreslit) { const y = window.scrollY; kresli(); window.scrollTo(0, y); } else panel(true);
    };
    vykresliKartu(list, host); pripoj(list, host, naZmenu);
  } else if (list.typ === 'text') {
    host.innerHTML = `<label class="f"><span>Text listu „${esc(list.nazev)}“</span><textarea rows="24" id="t-text">${esc(list.text)}</textarea></label>`;
    $('#t-text').oninput = (e) => { list.text = e.target.value; uloz(); };
  } else {
    S.ed = vytvorEditor({
      host, projekt: S.p, list, katalog,
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
      if (S.panel === 'metodika') host.innerHTML = METODIKA;
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

// ---------- start ----------
Promise.all([U.init(), nactiKatalog().then((k) => { katalog = k; }).catch((e) => ohlas(`Katalog značek se nenačetl: ${e.message}`, true))]).finally(smeruj);
