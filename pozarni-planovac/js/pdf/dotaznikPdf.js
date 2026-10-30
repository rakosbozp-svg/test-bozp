// Dotazník pro klienta jako VYPLNITELNÉ PDF (formulářová pole) a načtení vyplněného PDF zpět.
// Pole se jmenují podle id otázky (js/dotaznik.js). Písmo Roboto je vložené celé, aby šla psát česká diakritika.
// Pozn.: zda konkrétní prohlížeč PDF zobrazí při psaní vložené písmo, nelze z aplikace zaručit – načtení hodnot zpět ověřují testy.
import { nactiPdfLib, nactiFonty } from './export.js';
import { OTAZKY, SEKCE, textOdpovedi, cisloZOdpovedi } from '../dotaznik.js';

const MM = 72 / 25.4, W = 210, H = 297, OK = 15;
const ZNAKY = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽäľĺôŕÄĽĹÔŔöüÖÜß–—„“‚‘…°±×÷€§²³µ·';

export async function dotaznikDoPdf(dotaznik, { objekt = '', zpracovatel = '' } = {}) {
  const L = await nactiPdfLib(), doc = await L.PDFDocument.create(); doc.registerFontkit(L.fontkit);
  const f = await nactiFonty(), reg = await doc.embedFont(f.regular, { subset: true }), bold = await doc.embedFont(f.bold, { subset: true });
  reg.encodeText(ZNAKY);   // do podmnožiny písma vložit celou českou a slovenskou abecedu, aby šla psát do polí
  doc.setTitle(`Dotazník pro zpracování DZP${objekt ? ` – ${objekt}` : ''}`); doc.setCreator('Požární plánovač');
  const form = doc.getForm(), cerna = L.rgb(0, 0, 0), seda = L.rgb(0.35, 0.35, 0.35);
  let page, y;
  const nova = () => { page = doc.addPage([W * MM, H * MM]); y = OK; };
  const Y = (mm) => (H - mm) * MM;
  const zalom = (t, font, size, sirka) => { const out = []; let cur = ''; for (const w of String(t).split(/\s+/)) { const z = cur ? `${cur} ${w}` : w; if (font.widthOfTextAtSize(z, size) > sirka * MM && cur) { out.push(cur); cur = w; } else cur = z; } if (cur) out.push(cur); return out; };
  const text = (t, size, font = reg, barva = cerna) => { for (const r of zalom(t, font, size, W - 2 * OK)) { if (y + size * 0.5 > H - OK) nova(); page.drawText(r, { x: OK * MM, y: Y(y + size * 0.35), size, font, color: barva }); y += size * 0.45; } };
  nova();
  text('Dotazník pro zpracování dokumentace zdolávání požárů', 16, bold); y += 2;
  if (objekt) text(`Objekt: ${objekt}`, 11, bold);
  text('Prosíme o vyplnění údajů, které nejsou v projektové dokumentaci (PBŘ) nebo se od ní mohly změnit. Co nelze doplnit nebo se objektu netýká, vyplňte „NE“. Vyplněný soubor uložte a vraťte zpracovateli.', 9.5, reg, seda);
  if (zpracovatel) text(`Zpracovatel: ${zpracovatel}`, 9.5, reg, seda);
  y += 3;
  for (const s of SEKCE) {
    if (y + 38 > H - OK) nova();
    y += 2; text(s, 12, bold); y += 1;
    for (const q of OTAZKY.filter((x) => x.sekce === s)) {
      const vyska = q.typ === 'area' ? 18 : 7.5;
      const radky = zalom(q.text, reg, 9.5, W - 2 * OK).length;
      if (y + radky * 4.3 + vyska + 4 > H - OK) nova();
      text(q.text, 9.5);
      const box = { x: OK * MM, y: Y(y + 1 + vyska), width: (q.typ === 'text' || q.typ === 'area' ? W - 2 * OK : 50) * MM, height: vyska * MM };
      const hodnota = textOdpovedi(q, dotaznik.odpovedi[q.id]);
      if (q.typ === 'ano_ne') {
        const dd = form.createDropdown(q.id); dd.addOptions(['', 'ano', 'ne']); if (hodnota) dd.select(hodnota);
        dd.addToPage(page, { ...box, font: reg, borderColor: seda, borderWidth: 0.6 });
      } else {
        const tf = form.createTextField(q.id); if (q.typ === 'area') tf.enableMultiline(); if (hodnota) tf.setText(hodnota);
        tf.addToPage(page, { ...box, font: reg, borderColor: seda, borderWidth: 0.6 }); tf.setFontSize(q.typ === 'area' ? 9 : 10);
      }
      y += vyska + 4;
    }
  }
  form.updateFieldAppearances(reg);
  return doc.save();
}

// Přečte hodnoty z vyplněného PDF. Vrací { odpovedi, nalezeno, puvodni (text číselných odpovědí s jednotkou apod.), nectene (číselné
// odpovědi, ze kterých nejde jednoznačně přečíst číslo) } – pole, která formulář nemá, se ignorují.
export async function dotaznikZPdf(bajty) {
  const L = await nactiPdfLib();
  let doc;
  try { doc = await L.PDFDocument.load(bajty, { ignoreEncryption: true }); } catch (e) { throw new Error(`Soubor není čitelné PDF (${e.message}).`); }
  const pole = new Map(doc.getForm().getFields().map((x) => [x.getName(), x]));
  if (!pole.size) throw new Error('PDF neobsahuje formulářová pole – není to vyplnitelný dotazník z Požárního plánovače (vytištěný a naskenovaný dotazník přepište ručně).');
  const odpovedi = {}, puvodni = {}, nectene = []; let nalezeno = 0;
  for (const q of OTAZKY) {
    const x = pole.get(q.id); if (!x) continue; nalezeno++;
    let v = x.constructor.name.includes('Dropdown') || typeof x.getSelected === 'function' ? (x.getSelected?.()[0] ?? '') : (x.getText?.() ?? '');
    v = String(v ?? '').trim(); if (!v) continue;
    if (q.typ === 'ano_ne') { const t = v.toLowerCase(); odpovedi[q.id] = t === 'ano' ? true : t === 'ne' ? false : null; if (odpovedi[q.id] === null) delete odpovedi[q.id]; }
    else if (q.typ === 'cislo') {                                          // číslo i s jednotkou („49,5 kWp“); nejednoznačné se nahlásí
      const n = cisloZOdpovedi(v);
      if (n === null) nectene.push(`${q.text}: „${v}“`); else { odpovedi[q.id] = n; if (!/^[-+]?[\d\s\u00a0.,]+$/.test(v)) puvodni[q.id] = v; }
    }
    else odpovedi[q.id] = v;
  }
  if (!nalezeno) throw new Error('PDF má formulářová pole, ale žádné neodpovídá dotazníku Požárního plánovače.');
  return { odpovedi, nalezeno, puvodni, nectene };
}
