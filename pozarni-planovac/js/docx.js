// Text z dokumentu Word (.docx) – průvodní a souhrnná technická zpráva, PBŘ ve Wordu.
// DOCX je ZIP; čte se jen word/document.xml (odstavce, tabulátory, buňky tabulek jako odstavce). Bez knihovny – DecompressionStream.

async function rozbal(bajty, data) {
  if (data.method === 0) return bajty.subarray(data.od, data.od + data.velikost);
  if (data.method !== 8) throw new Error('Nepodporovaná komprese v DOCX.');
  const proud = new Blob([bajty.subarray(data.od, data.od + data.velikost)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(proud).arrayBuffer());
}

// Najde soubor v ZIP podle centrálního adresáře (velikosti v lokální hlavičce mohou být 0 – datový deskriptor).
export async function souborZeZip(bajty, jmeno) {
  const dv = new DataView(bajty.buffer, bajty.byteOffset, bajty.byteLength);
  let eocd = -1;
  for (let i = bajty.length - 22; i >= Math.max(0, bajty.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Soubor není platný DOCX (ZIP).');
  let p = dv.getUint32(eocd + 16, true);
  const n = dv.getUint16(eocd + 10, true), dek = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), velikost = dv.getUint32(p + 20, true), dn = dv.getUint16(p + 28, true), ex = dv.getUint16(p + 30, true), km = dv.getUint16(p + 32, true), lok = dv.getUint32(p + 42, true);
    const nazev = dek.decode(bajty.subarray(p + 46, p + 46 + dn));
    if (nazev === jmeno) { const od = lok + 30 + dv.getUint16(lok + 26, true) + dv.getUint16(lok + 28, true); return rozbal(bajty, { method, velikost, od }); }
    p += 46 + dn + ex + km;
  }
  return null;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function odstavceZXml(xml) {
  // smazaný text revizí (w:del), kódy polí (PAGEREF…) a náhradní obsah (mc:Fallback) se nečtou; zalomení řádku i s atributy
  return xml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '').replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '').replace(/<mc:Fallback\b[^>]*>[\s\S]*?<\/mc:Fallback>/g, '')
    .replace(/<w:tab\/>/g, '\t').replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n').split(/<\/w:p>/)
    .map((p) => p.replace(/<[^>]+>/g, '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10)) : ENT[e] ?? m)))
    .flatMap((p) => p.split('\n')).map((p) => p.replace(/[….]{4,}/g, ' ').replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean);
}

// Vrací „stránky“ ve tvaru rozborPbr: jedna stránka = všechny odstavce (DOCX stránky nemá).
export async function stranyZDocx(bajty) {
  const doc = await souborZeZip(bajty, 'word/document.xml');
  if (!doc) throw new Error('V souboru chybí word/document.xml – není to dokument Word (.docx).');
  return [odstavceZXml(new TextDecoder().decode(doc))];
}
