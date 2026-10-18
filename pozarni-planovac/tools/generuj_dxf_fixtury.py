#!/usr/bin/env python3
"""Vygeneruje testovací DXF soubory knihovnou ezdxf (skutečný generátor DXF, ne ruční text).
Použití: python3 tools/generuj_dxf_fixtury.py   (vyžaduje: pip install ezdxf)"""
import math, pathlib
import ezdxf
from ezdxf import units

OUT = pathlib.Path(__file__).resolve().parent.parent / 'test' / 'fixtury'
OUT.mkdir(exist_ok=True)

def plan(doc, k=1.0):
    """Půdorys haly 20 × 10 m v jednotkách, kde 1 m = k jednotek."""
    msp = doc.modelspace()
    doc.layers.add('STENY', color=7)
    doc.layers.add('DVERE', color=3)
    doc.layers.add('TEXTY', color=1)
    doc.layers.add('KOTY', color=5)
    doc.layers.add('SKRYTA', color=2)
    doc.layers.get('SKRYTA').off()
    doc.layers.add('ZMRAZENA', color=4); doc.layers.get('ZMRAZENA').freeze()
    msp.add_lwpolyline([(0, 0), (20 * k, 0), (20 * k, 10 * k), (0, 10 * k)], close=True, dxfattribs={'layer': 'STENY'})
    msp.add_line((10 * k, 0), (10 * k, 10 * k), dxfattribs={'layer': 'STENY'})
    d = doc.blocks.new('DVERE_90')
    d.add_line((0, 0), (0.9 * k, 0)); d.add_arc((0, 0), 0.9 * k, 0, 90)
    msp.add_blockref('DVERE_90', (3 * k, 0), dxfattribs={'layer': 'DVERE', 'xscale': 1, 'yscale': 1})
    msp.add_blockref('DVERE_90', (14 * k, 10 * k), dxfattribs={'layer': 'DVERE', 'rotation': 180})
    h = doc.blocks.new('HYDRANT'); h.add_circle((0, 0), 0.4 * k); h.add_line((0, 0.4 * k), (0, 0.9 * k))
    msp.add_blockref('HYDRANT', (22 * k, 5 * k), dxfattribs={'layer': 'TEXTY'})
    msp.add_circle((5 * k, 5 * k), 1.2 * k, dxfattribs={'layer': 'STENY'})
    msp.add_arc((15 * k, 5 * k), 2 * k, 30, 150, dxfattribs={'layer': 'STENY'})
    msp.add_ellipse((15 * k, 8 * k), major_axis=(2 * k, 0, 0), ratio=0.5)
    msp.add_spline([(0, 12 * k), (5 * k, 14 * k), (10 * k, 12 * k), (15 * k, 14 * k)])
    msp.add_text('Výrobní hala – ČERPADLO', height=0.5 * k, dxfattribs={'layer': 'TEXTY', 'insert': (1 * k, 1 * k), 'rotation': 0})
    msp.add_text('Ro%%c100 45%%d', height=0.4 * k, dxfattribs={'layer': 'TEXTY', 'insert': (1 * k, 2 * k), 'rotation': 90})
    mt = msp.add_mtext('{\\fArial|b0|i0|c238;Strojní dílny}\\PI. NP \\U+010Cerpadlo &amp; sklad', dxfattribs={'layer': 'TEXTY', 'char_height': 0.6 * k, 'insert': (11 * k, 9 * k), 'attachment_point': 1})
    msp.add_linear_dim(base=(0, -2 * k), p1=(0, 0), p2=(20 * k, 0), dxfattribs={'layer': 'KOTY'}).render()
    msp.add_aligned_dim(p1=(20 * k, 0), p2=(20 * k, 10 * k), distance=2 * k, dxfattribs={'layer': 'KOTY'}).render()
    hatch = msp.add_hatch(color=2); hatch.paths.add_polyline_path([(0, 0), (2 * k, 0), (2 * k, 2 * k), (0, 2 * k)])
    msp.add_line((0, 0), (1 * k, 1 * k), dxfattribs={'layer': 'SKRYTA'})
    msp.add_line((0, 0), (1 * k, 2 * k), dxfattribs={'layer': 'ZMRAZENA'})
    msp.add_polyline2d([(0, 16 * k), (5 * k, 16 * k), (5 * k, 18 * k)], dxfattribs={'layer': 'STENY'})
    msp.add_lwpolyline([(0, 20 * k, 0), (4 * k, 20 * k, 0.5), (4 * k, 22 * k, 0)], format='xyb', dxfattribs={'layer': 'STENY'})   # oblouk (bulge)

# 1) metry, INSUNITS = 6
doc = ezdxf.new('R2018', setup=True); doc.units = units.M; plan(doc, 1.0); doc.saveas(OUT / 'hala_m.dxf')
# 2) milimetry, INSUNITS = 4
doc = ezdxf.new('R2018', setup=True); doc.units = units.MM; plan(doc, 1000.0); doc.saveas(OUT / 'hala_mm.dxf')
# 3) bez jednotek (INSUNITS = 0), výkres v mm
doc = ezdxf.new('R2018', setup=True); doc.header['$INSUNITS'] = 0; plan(doc, 1000.0); doc.saveas(OUT / 'hala_bez_jednotek_mm.dxf')
# 4) starší formát R2000 s kódovou stránkou cp1250 (české znaky v bajtech cp1250)
doc = ezdxf.new('R2000', setup=True); doc.units = units.M; doc.encoding = 'cp1250'; plan(doc, 1.0); doc.saveas(OUT / 'hala_r2000_cp1250.dxf')
print('hotovo:', sorted(p.name for p in OUT.glob('*.dxf')))
