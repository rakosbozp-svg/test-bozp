// Falešné úložiště artefaktu (schopnosti „db“ a „user“, podmnožina typů platformy 0.2.96) pro testy v Node i v prohlížeči.
// Soběstačná funkce bez importů a vnějších proměnných: do stránky se vkládá přes falesneUloziste.toString().
// dokumenty: prostý objekt cesta → data (lze serializovat a předat novému kontextu prohlížeče).
// stav.pred(sloveso, cesta): háček před každou operací ('get' | 'set' | 'update' | 'delete' | 'list' | 'query'), může vyhodit {code, message}.
// stav.zapisy: [sloveso, cesta] každého provedeného zápisu; stav.cteni: [sloveso, cesta] každého čtení ('get', 'list' = celá kolekce, 'query' = dotaz s where).
export function falesneUloziste({ dokumenty = {}, uid = 'u1' } = {}) {
  const stav = { pred: null, zapisy: [], cteni: [] };
  const LIMIT = 256 * 1024, enc = new TextEncoder();
  const chyba = (code, message) => ({ code, message });
  const tik = () => new Promise((r) => setTimeout(r, 0));
  const krok = async (sloveso, cesta) => { await tik(); if (stav.pred) stav.pred(sloveso, cesta); };
  const kopie = (x) => JSON.parse(JSON.stringify(x));
  const segmenty = (cesta) => {
    const s = String(cesta).split('/');
    const spatny = (x) => !x || x === '.' || x === '..' || !/^[A-Za-z0-9_\-.~:@+]+$/.test(x) || enc.encode(x).length > 200;
    if (s.some(spatny) || s.length > 16 || enc.encode(String(cesta)).length > 1000) throw new TypeError(`Neplatná cesta: ${cesta}`);
    return s;
  };
  const snimek = (cesta) => {
    const d = dokumenty[cesta];
    return { id: cesta.split('/').pop(), exists: d !== undefined, data: () => (d === undefined ? undefined : kopie(d)), metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const zapis = (cesta, data, sloveso) => {
    const text = JSON.stringify(data);
    if (enc.encode(text).length > LIMIT) throw chyba('invalid_argument', 'Dokument je větší než 256 KiB');
    dokumenty[cesta] = JSON.parse(text); stav.zapisy.push([sloveso, cesta]);
  };
  function doc(cesta) {
    const s = segmenty(cesta);
    if (s.length % 2) throw new TypeError(`Cesta dokumentu musí mít sudý počet segmentů: ${cesta}`);
    return {
      id: s[s.length - 1], path: cesta,
      async get() { await krok('get', cesta); stav.cteni.push(['get', cesta]); return snimek(cesta); },
      async set(data) { await krok('set', cesta); zapis(cesta, data, 'set'); await tik(); },
      async update(data) {
        await krok('update', cesta);
        if (dokumenty[cesta] === undefined) throw chyba('invalid_argument', 'update neexistujícího dokumentu');
        zapis(cesta, { ...dokumenty[cesta], ...kopie(data) }, 'update'); await tik();
      },
      async delete() { await krok('delete', cesta); delete dokumenty[cesta]; stav.zapisy.push(['delete', cesta]); await tik(); },
      collection: (nazev) => collection(`${cesta}/${nazev}`),
    };
  }
  function collection(cesta) {
    const s = segmenty(cesta);
    if (s.length % 2 === 0) throw new TypeError(`Cesta kolekce musí mít lichý počet segmentů: ${cesta}`);
    const OP = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b };
    const dotaz = (filtry) => ({
      where: (pole, op, hodnota) => { if (!OP[op]) throw new TypeError(`Nepodporovaný operátor ${op}`); return dotaz([...filtry, [pole, op, hodnota]]); },
      async get() {
        const sloveso = filtry.length ? 'query' : 'list';
        await krok(sloveso, cesta); stav.cteni.push([sloveso, cesta]);
        const pred = `${cesta}/`;
        const docs = Object.keys(dokumenty).filter((k) => k.startsWith(pred) && !k.slice(pred.length).includes('/'))
          .filter((k) => filtry.every(([pole, op, hodnota]) => dokumenty[k][pole] !== undefined && OP[op](dokumenty[k][pole], hodnota))).sort().map(snimek);
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
      },
    });
    return { ...dotaz([]), doc: (id) => doc(`${cesta}/${id}`) };
  }
  const db = { doc, collection }, user = { id: async () => uid };
  return { claude: { use: async (n) => (n === 'db' ? db : n === 'user' ? user : null) }, dokumenty, stav };
}
