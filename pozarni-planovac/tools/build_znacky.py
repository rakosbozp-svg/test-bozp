#!/usr/bin/env python3
"""Vyřízne značky z podklady/Graficke_znacky_DZP.pdf (ČAHD, 11/2011) do PNG + SVG a katalogu.

Zdrojové značky v PDF jsou bitmapy (ne vektory), proto jsou PNG výřezy ve 600 dpi
s průhledným pozadím a SVG je pouze obálka kolem PNG. Název značky je text z PDF.
Použití: python3 tools/build_znacky.py   (vyžaduje pdftoppm, pdftotext, Pillow, numpy)
"""
import base64, io, json, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / 'podklady' / 'Graficke_znacky_DZP.pdf'
OUT = ROOT / 'znacky'
DPI_GRID, DPI_OUT = 300, 600
# Mřížka tabulky na 300 dpi (zjištěno detekcí čar), sloupce = tři dvojice symbol|název.
ROWS = [465, 607, 748, 890, 1032, 1173, 1315, 1457, 1598, 1740, 1882, 2023, 2165, 2307, 2448, 2590, 2732, 2873, 3015]
GRID = {
    1: (ROWS + [3157], [177, 925, 1673, 2421]),
    2: (ROWS, [82, 830, 1578, 2326]),
}
# Buňky stránky 2, které nejsou značkou, ale poznámkou (řádek, sloupec).
NOT_SYMBOL = {(2, 15, 3), (2, 18, 3)}


def render(page, dpi, d):
    base = Path(d) / f'p{page}_{dpi}'
    subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-f', str(page), '-l', str(page), str(PDF), str(base)], check=True)
    f = next(Path(d).glob(f'p{page}_{dpi}*.png'))
    return Image.open(f).convert('RGB')


def words(page):
    html = subprocess.run(['pdftotext', '-bbox-layout', '-f', str(page), '-l', str(page), str(PDF), '-'],
                          check=True, capture_output=True, text=True).stdout
    s = DPI_GRID / 72
    return [(float(a) * s, float(b) * s, float(c) * s, float(d) * s, w.replace('&amp;', '&'))
            for a, b, c, d, w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', html)]


def clean(t):
    if re.search(r' 3 (?=.*\(\s*objem v m\s*\))', t):   # horní index 3 se v PDF oddělil od „m"
        t = re.sub(r' 3 ', ' ', t, count=1)
        t = re.sub(r'\(\s*objem v m\s*\)', '(objem v m³)', t)
    t = re.sub(r'\bm ?3\b', 'm³', t)
    t = re.sub(r'CO ?2\b', 'CO₂', t)
    t = re.sub(r'^(TOTAL STOP|CENTRAL STOP) ', r'\1 – ', t)
    return re.sub(r'\s+', ' ', t).replace('( ', '(').replace(' )', ')').strip()


def to_rgba(img):
    a = np.array(img).astype(float)
    alpha = 255 - a.min(axis=2)               # bílá -> průhledná
    safe = np.maximum(alpha, 1)
    rgb = np.clip((a - (255 - alpha[..., None])) * 255 / safe[..., None], 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha]).astype('uint8'), 'RGBA')


def main():
    for sub in ('png', 'svg'):
        for f in (OUT / sub).glob('*'):
            f.unlink()
    catalog, n = [], 0
    with tempfile.TemporaryDirectory() as d:
        for page in (1, 2):
            rows, cols = GRID[page]
            big = render(page, DPI_OUT, d)
            small = np.array(render(page, DPI_GRID, d)).astype(int)
            ws = words(page)
            k = DPI_OUT / DPI_GRID
            for r in range(len(rows) - 1):
                for c in range(len(cols) - 1):
                    if (page, r + 1, c + 1) in NOT_SYMBOL:
                        continue
                    x0, x1, y0, y1 = cols[c] + 4, cols[c + 1] - 4, rows[r] + 4, rows[r + 1] - 4
                    cw = sorted([w for w in ws if x0 <= (w[0] + w[2]) / 2 <= x1 and y0 <= (w[1] + w[3]) / 2 <= y1],
                                key=lambda w: (round(w[1] / 20), w[0]))
                    if not cw:
                        continue
                    if (page, c + 1) == (2, 3) and r + 1 in (16, 17):
                        # TOTAL STOP / CENTRAL STOP: písmeno T / C patří ke značce, vlevo je okraj tabulky
                        letter = next(w for w in cw if w[4] in ('T', 'C'))
                        cw = [w for w in cw if w is not letter]
                        x0 += 10
                        sx1 = int(letter[2]) + 6
                    else:
                        sx1 = int(min(w[0] for w in cw)) - 6
                    label = clean(' '.join(w[4] for w in cw))
                    n += 1
                    code = f'DZP-{n:03d}'
                    crop = to_rgba(big.crop((int(x0 * k), int(y0 * k), int(sx1 * k), int(y1 * k))))
                    bbox = crop.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
                    if bbox is None:
                        sys.exit(f'{code}: prázdný výřez')
                    pad = 6
                    bbox = (max(bbox[0] - pad, 0), max(bbox[1] - pad, 0), min(bbox[2] + pad, crop.width), min(bbox[3] + pad, crop.height))
                    crop = crop.crop(bbox)
                    crop.save(OUT / 'png' / f'{code}.png')
                    buf = io.BytesIO(); crop.save(buf, 'PNG')
                    b64 = base64.b64encode(buf.getvalue()).decode()
                    w, h = crop.size
                    (OUT / 'svg' / f'{code}.svg').write_text(
                        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                        f'viewBox="0 0 {w} {h}" width="{w}" height="{h}"><title>{label}</title>'
                        f'<image width="{w}" height="{h}" xlink:href="data:image/png;base64,{b64}"/></svg>\n', encoding='utf8')
                    catalog.append({'id': code, 'nazev': label, 'zdroj': 'Značky DZP, ČAHD, 11/2011',
                                    'strana': page, 'radek': r + 1, 'sloupec': c + 1,
                                    'png': f'znacky/png/{code}.png', 'svg': f'znacky/svg/{code}.svg',
                                    'sirka': w, 'vyska': h, 'overeno': False})
    (OUT / 'katalog.json').write_text(json.dumps({'zdroj': 'Graficke_znacky_DZP.pdf (ČAHD, aktualizováno 11/2011)',
                                                  'pocet': len(catalog), 'znacky': catalog}, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    print('hotovo:', len(catalog), 'značek')


if __name__ == '__main__':
    main()
