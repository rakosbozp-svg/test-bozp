// Načtení rastrového podkladu (PNG/JPG) a vložení do výkresu. Velké obrázky se zmenší (max 3000 px).
import { rozlozeniListu } from './prvky.js';

export async function nactiObrazek(soubor) {
  if (!soubor) throw new Error('Nebyl vybrán soubor.');
  if (!/^image\/(png|jpeg)$/.test(soubor.type)) throw new Error('Podporované podklady: PNG nebo JPG. DXF, SVG a PDF přibudou v dalším kroku.');
  if (soubor.size > 25 * 1024 * 1024) throw new Error('Soubor je větší než 25 MB.');
  const url = URL.createObjectURL(soubor), img = new Image();
  try {
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('Obrázek se nepodařilo načíst.')); img.src = url; });
    let w = img.naturalWidth, h = img.naturalHeight, data;
    const k = Math.min(1, 3000 / Math.max(w, h));
    if (k < 1 || soubor.size > 4 * 1024 * 1024) {
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      data = c.toDataURL(soubor.type === 'image/png' && soubor.size < 4 * 1024 * 1024 ? 'image/png' : 'image/jpeg', 0.88); w = c.width; h = c.height;
    } else data = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(soubor); });
    return { nazev: soubor.name, mime: soubor.type, data, w, h };
  } finally { URL.revokeObjectURL(url); }
}

// Podklad se vloží do levého horního rohu rámu a roztáhne přibližně na 90 % šířky; měřítko je NEOVĚŘENÉ do kalibrace.
export function vlozPodklad(projekt, vykres, ob) {
  const id = `pr_${Math.random().toString(36).slice(2, 10)}`;
  projekt.prilohy[id] = { nazev: ob.nazev, mime: ob.mime, data: ob.data };
  const { ram } = rozlozeniListu(vykres), sirkaM = ((ram.w * vykres.meritko.pomer) / 1000) * 0.9;
  vykres.pozadi = { prilohaId: id, nazev: ob.nazev, x: vykres.okno.x, y: vykres.okno.y, sirkaPx: ob.w, vyskaPx: ob.h, mNaPx: sirkaM / ob.w, kryti: 0.8, kalibrace: null, zamceno: false };
}
