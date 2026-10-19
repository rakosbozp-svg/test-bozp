// Výpočty z GPS (WGS 84): vzdálenost vzdušnou čarou a čtení souřadnic vložených z map.

// Vzdálenost dvou bodů po povrchu Země (haversine, R = 6 371 km) v metrech; null, chybí-li souřadnice.
export function vzdalenostM(a, b) {
  const ok = (g) => g && Number.isFinite(g.sirka) && Number.isFinite(g.delka) && Math.abs(g.sirka) <= 90 && Math.abs(g.delka) <= 180;
  if (!ok(a) || !ok(b)) return null;
  const r = (x) => (x * Math.PI) / 180, dS = r(b.sirka - a.sirka), dD = r(b.delka - a.delka);
  const h = Math.sin(dS / 2) ** 2 + Math.cos(r(a.sirka)) * Math.cos(r(b.sirka)) * Math.sin(dD / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Text pro formulář: „vzdušnou čarou od objektu cca 140 m“ (zaokrouhleno na 10 m, do 100 m na 5 m).
export function textVzdalenosti(objekt, zdroj) {
  const d = vzdalenostM(objekt, zdroj);
  if (d === null) return '';
  const z = d < 100 ? Math.round(d / 5) * 5 : Math.round(d / 10) * 10;
  return `Vzdušnou čarou od objektu cca ${z.toLocaleString('cs-CZ')} m (z GPS; skutečná trasa hadic bývá delší).`;
}

// Souřadnice vložené jedním textem: „50.1452539N, 14.0968236E“ (Mapy.cz), „50.1452539, 14.0968236“ (Google),
// „50°8'42.914"N, 14°5'48.565"E“ nebo „N 50°8.71523', E 14°5.80941'“. Vrací { sirka, delka } nebo null.
export function ctiGps(text) {
  const t = String(text ?? '').trim().replace(/,(?=\d)/g, '.');   // desetinná čárka → tečka (jen mezi číslicemi)
  const casti = [];
  const re = /([NSEW])?\s*(\d{1,3}(?:\.\d+)?)\s*°?\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′]\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:["″]|''))?)?\s*([NSEW])?/giu;
  let m;
  while ((m = re.exec(t)) && casti.length < 2) {
    if (!m[2]) { re.lastIndex++; continue; }
    let v = Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0) + (m[4] ? Number(m[4]) / 3600 : 0);
    const sm = (m[1] || m[5] || '').toUpperCase();
    if (sm === 'S' || sm === 'W') v = -v;
    casti.push({ v, sm });
  }
  if (casti.length !== 2) return null;
  let [a, b] = casti;
  if (a.sm === 'E' || a.sm === 'W' || b.sm === 'N' || b.sm === 'S') [a, b] = [b, a];   // „E …, N …“
  const g = { sirka: a.v, delka: b.v };
  return Math.abs(g.sirka) <= 90 && Math.abs(g.delka) <= 180 ? g : null;
}
