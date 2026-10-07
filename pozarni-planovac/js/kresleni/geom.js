// Geometrie ve světových souřadnicích (metry). Čisté funkce, bez DOM.
export const EPS = 1e-9;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const rad = (deg) => (deg * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

export function delkaLomene(body, zavreny = false) {
  let s = 0;
  for (let i = 1; i < body.length; i++) s += dist(body[i - 1], body[i]);
  if (zavreny && body.length > 2) s += dist(body[body.length - 1], body[0]);
  return s;
}

export function nejblizsiNaUsecce(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 < EPS ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { bod: q, t, d: dist(p, q) };
}

export function nejblizsiNaLomene(p, body, zavreny = false) {
  let best = null;
  const n = zavreny ? body.length : body.length - 1;
  for (let i = 0; i < n; i++) {
    const r = nejblizsiNaUsecce(p, body[i], body[(i + 1) % body.length]);
    if (!best || r.d < best.d) best = { ...r, seg: i };
  }
  return best;
}

// Bod na lomené čáře: segment `seg`, parametr t (0–1). Vrací i jednotkový směr segmentu.
export function bodNaLomene(body, seg, t) {
  const n = body.length - 1;
  if (n < 1) return null;
  const i = Math.max(0, Math.min(n - 1, Math.floor(seg)));
  const a = body[i], b = body[i + 1], L = dist(a, b) || 1;
  return { bod: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], smer: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], delka: L, seg: i };
}

export function bodVPolygonu(p, body) {
  let v = false;
  for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
    const [xi, yi] = body[i], [xj, yj] = body[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) v = !v;
  }
  return v;
}

export const otoc = (p, c, r) => {
  const s = Math.sin(r), k = Math.cos(r), x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * k - y * s, c[1] + x * s + y * k];
};

export function bbox(pts) {
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}
export const spojBbox = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

// Ramer–Douglas–Peucker: zjednodušení volné kresby.
export function zjednodus(body, tol) {
  if (body.length < 3) return body.slice();
  let max = 0, idx = 0;
  const a = body[0], b = body[body.length - 1];
  for (let i = 1; i < body.length - 1; i++) {
    const d = nejblizsiNaUsecce(body[i], a, b).d;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [a, b];
  return [...zjednodus(body.slice(0, idx + 1), tol).slice(0, -1), ...zjednodus(body.slice(idx), tol)];
}

export const zaokrouhli = (v, krok) => (krok > 0 ? Math.round(v / krok) * krok : v);
