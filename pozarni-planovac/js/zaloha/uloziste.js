// Vrstva nad soukromým úložištěm artefaktu na claude.ai (schopnosti „db“ a „user“): hlavičky a části záloh projektů.
// Cesty: hlavička data/users/<uid>/<seg(pid)>, části data/users/<uid>/<seg(pid)>/casti/<verze>_<i> = {d, t}.
// data/users/<uid>/ je podle platformy soukromé pro každého uživatele (i před vlastníkem artefaktu u cizích podstromů).
import { bezpecnySegment, zpetSegment } from './kodovani.js';

/** @typedef {{format: 1, nazev: string, typ: string, zmeneno: string, velikost: number, sha256: string, verze: string,
 *   casti: number, komprese: 'gzip'|'zadna', zalohovano: string, smazano: string|null}} Hlavicka */

export const STARI_SIROTCI_MS = 3600000;   // části jiné verze starší než hodina jsou zbytky přerušených záloh

// Kód chyby úložiště (db.d.ts: invalid_argument, resource_exhausted, quota_exceeded, unavailable, revoked …).
export const kodChyby = (e) => (typeof e?.code === 'string' && e.code ? e.code : 'unavailable');

const sLimitem = (slib, ms) => new Promise((ok) => {
  const t = setTimeout(() => ok(null), ms);
  slib.then((v) => { clearTimeout(t); ok(v); }, () => { clearTimeout(t); ok(null); });
});
const verzeCasti = (id) => id.slice(0, id.lastIndexOf('_'));

// Připojí úložiště (nejdéle limitMs). null = nedostupné: mimo claude.ai, odhlášený uživatel, odepřené nebo nefunkční úložiště.
export async function pripoj({ claude = globalThis.claude, limitMs = 10000 } = {}) {
  if (!claude || typeof claude.use !== 'function') return null;
  const spojeni = await sLimitem((async () => {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!db || !user) return null;
    const uid = await user.id();
    return typeof uid === 'string' && uid ? { db, uid } : null;
  })(), limitMs);
  if (!spojeni) return null;
  try { return vytvor(spojeni.db, spojeni.uid); } catch { return null; }   // id porušující gramatiku cest → builder vyhodí TypeError
}

function vytvor(db, uid) {
  const koren = db.collection(`data/users/${uid}`);
  const hlavicka = (pid) => koren.doc(bezpecnySegment(pid));
  const casti = (pid) => db.doc(`data/users/${uid}/${bezpecnySegment(pid)}`).collection('casti');
  return {
    uid,
    /** @returns {Promise<Array<Hlavicka & {pid: string}>>} */
    async hlavicky() {
      const s = await koren.get();
      return s.docs.filter((d) => d.exists && d.data()?.format === 1).map((d) => ({ ...d.data(), pid: zpetSegment(d.id) }));
    },
    // Části se zapisují postupně (jedna po druhé); každá nese čas zápisu kvůli úklidu (hodiny zálohy, viz autozaloha.js).
    async zapisCasti(pid, verze, data, kdy = new Date().toISOString()) {
      const k = casti(pid);
      for (let i = 0; i < data.length; i++) await k.doc(`${verze}_${i}`).set({ d: data[i], t: kdy });
    },
    zapisHlavicku: (pid, h) => hlavicka(pid).set(h),
    async oznacSmazany(pid, kdy) {
      const r = hlavicka(pid);
      if (!(await r.get()).exists) return false;
      await r.update({ smazano: kdy });
      return true;
    },
    zrusSmazani: (pid) => hlavicka(pid).update({ smazano: null }),
    // Smaže části jiné verze než platné: předchozí verzi hlavičky a sirotky starší než hodina. Čerstvé cizí části nechá –
    // může je právě zapisovat jiná karta nebo počítač. Vrací počet smazaných.
    async uklid(pid, platna, predchozi, tedMs = Date.now()) {
      const k = casti(pid), s = await k.get();
      let n = 0;
      for (const d of s.docs) {
        const v = verzeCasti(d.id);
        if (v === platna) continue;
        const t = Date.parse(d.data()?.t ?? '');
        if (v === predchozi || !(t > tedMs - STARI_SIROTCI_MS)) { await k.doc(d.id).delete(); n++; }
      }
      return n;
    },
    // Data verze z hlavičky (spojené části). Chybějící část → {code: 'chybi_cast'}.
    async ctiData(pid, h) {
      const k = casti(pid);
      let data = '';
      for (let i = 0; i < h.casti; i++) {
        const s = await k.doc(`${h.verze}_${i}`).get(), d = s.exists ? s.data()?.d : undefined;
        if (typeof d !== 'string') throw { code: 'chybi_cast', message: `Chybí část ${i + 1} z ${h.casti}` };
        data += d;
      }
      return data;
    },
    async odstran(pid) {
      const k = casti(pid), s = await k.get();
      for (const d of s.docs) await k.doc(d.id).delete();
      await hlavicka(pid).delete();
    },
  };
}
