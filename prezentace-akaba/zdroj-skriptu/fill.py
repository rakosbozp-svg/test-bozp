import sys
from pptx import Presentation
from pptx.util import Inches as In, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION
from pptx.oxml.ns import qn
from lxml import etree

SRC, IMG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

TEAL = RGBColor(0x00, 0xA4, 0x99)
TEAL_D = RGBColor(0x00, 0x7A, 0x72)
ORANGE = RGBColor(0xFF, 0x82, 0x00)
DARK = RGBColor(0x30, 0x30, 0x30)
GREY = RGBColor(0x6B, 0x6B, 0x6B)
LTEAL = RGBColor(0xE5, 0xF5, 0xF4)
LOR = RGBColor(0xFF, 0xF1, 0xE3)
LGREY = RGBColor(0xF2, 0xF2, 0xF2)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
RED = RGBColor(0xE3, 0x00, 0x0F)
CHLOR = RGBColor(0xD6, 0xE0, 0x5C)
NAVY = RGBColor(0x2F, 0x3E, 0x4E)
SEA = RGBColor(0xCF, 0xE8, 0xF1)
STEEL = RGBColor(0x59, 0x59, 0x59)
TABLE_STYLE = "{72833802-FEF1-4C79-8D5D-14CF1EAF98D9}"  # styl tabulek ze šablony FBI

prs = Presentation(SRC)
S = list(prs.slides)
assert len(S) == 14, len(S)


# ---------- helpers ----------
def _bullet(p, char="•", color=None, marL=0.22):
    pPr = p._p.get_or_add_pPr()
    pPr.set("marL", str(int(In(marL))))
    pPr.set("indent", str(-int(In(marL))))
    for tag in ("a:buNone", "a:buChar", "a:buAutoNum", "a:buFont", "a:buClr"):
        for e in pPr.findall(qn(tag)):
            pPr.remove(e)
    if color is not None:
        buClr = etree.SubElement(pPr, qn("a:buClr"))
        c = etree.SubElement(buClr, qn("a:srgbClr"))
        c.set("val", str(color))
    buFont = etree.SubElement(pPr, qn("a:buFont"))
    buFont.set("typeface", "Arial")
    bu = etree.SubElement(pPr, qn("a:buChar"))
    bu.set("char", char)


def fill(tf, paras, size=16, color=DARK, bold=False, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, space_after=4, margin=0.08, line=None):
    """paras: list of str | dict(t|runs, size, color, bold, bullet, align, after, italic, link)"""
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = In(margin)
    tf.margin_top = tf.margin_bottom = In(0.04)
    tf.vertical_anchor = anchor
    first = True
    for p in paras:
        if isinstance(p, str):
            p = {"t": p}
        para = tf.paragraphs[0] if first else tf.add_paragraph()
        if first:
            for r in list(para.runs):
                r._r.getparent().remove(r._r)
        first = False
        runs = p.get("runs") or [{"t": p.get("t", "")}]
        for r in runs:
            if isinstance(r, str):
                r = {"t": r}
            run = para.add_run()
            run.text = r["t"]
            f = run.font
            f.name = "Calibri"
            f.size = Pt(r.get("size", p.get("size", size)))
            f.bold = r.get("bold", p.get("bold", bold))
            f.italic = r.get("italic", p.get("italic", False))
            f.color.rgb = r.get("color", p.get("color", color))
            if r.get("link"):
                run.hyperlink.address = r["link"]
                f.color.rgb = r.get("color", TEAL_D)
                f.underline = True
        para.alignment = p.get("align", align)
        para.space_after = Pt(p.get("after", space_after))
        if line:
            para.line_spacing = line
        if p.get("bullet"):
            _bullet(para, p.get("char", "•"), p.get("bucolor", ORANGE))


def text(slide, x, y, w, h, paras, name=None, **kw):
    s = slide.shapes.add_textbox(In(x), In(y), In(w), In(h))
    fill(s.text_frame, paras, **kw)
    if name:
        s.name = name
    return s


def box(slide, x, y, w, h, color=LTEAL, shape=MSO_SHAPE.ROUNDED_RECTANGLE, line=None,
        radius=0.06, paras=None, name=None, dash=None, line_w=1.0, **kw):
    s = slide.shapes.add_shape(shape, In(x), In(y), In(w), In(h))
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
    if color is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = color
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(line_w)
        if dash:
            s.line.dash_style = dash
    s.shadow.inherit = False
    if paras is not None:
        fill(s.text_frame, paras, **kw)
    else:
        s.text_frame.text = ""
    if name:
        s.name = name
    return s


def conn(slide, x1, y1, x2, y2, color=STEEL, w=2.0, dash=None, arrow=False, name=None):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, In(x1), In(y1), In(x2), In(y2))
    c.line.color.rgb = color
    c.line.width = Pt(w)
    if dash:
        c.line.dash_style = dash
    if arrow:
        ln = c.line._get_or_add_ln()
        te = etree.SubElement(ln, qn("a:tailEnd"))
        te.set("type", "triangle")
        te.set("w", "med")
        te.set("len", "med")
    if name:
        c.name = name
    return c


def set_title(slide, t):
    title = slide.shapes.title
    title.width = Emu(11400000)
    p = title.text_frame.paragraphs[0]
    runs = p.runs
    runs[0].text = t
    for r in runs[1:]:
        r._r.getparent().remove(r._r)


def notes(slide, t):
    slide.notes_slide.notes_text_frame.text = t


def table(slide, x, y, w, rows, col_w, size=14, head_size=14, row_h=0.36, name=None):
    nr, nc = len(rows), len(rows[0])
    gs = slide.shapes.add_table(nr, nc, In(x), In(y), In(w), In(row_h * nr))
    tbl = gs.table
    tbl._tbl.tblPr.find(qn("a:tableStyleId")).text = TABLE_STYLE
    tbl.first_row = True
    tbl.horz_banding = False
    for i, cw in enumerate(col_w):
        tbl.columns[i].width = In(cw)
    for r in range(nr):
        tbl.rows[r].height = In(row_h)
        for c in range(nc):
            cell = tbl.cell(r, c)
            v = rows[r][c]
            spec = v if isinstance(v, dict) else {"t": v}
            cell.margin_left = cell.margin_right = In(0.08)
            cell.margin_top = cell.margin_bottom = In(0.03)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            fill(cell.text_frame, [dict(spec, size=spec.get("size", head_size if r == 0 else size),
                                        bold=spec.get("bold", r == 0),
                                        color=spec.get("color", WHITE if r == 0 else DARK))],
                 space_after=0, margin=0.08)
    if name:
        gs.name = name
    return gs


def stat(slide, x, y, w, h, big, label, color=TEAL, bg=LTEAL, big_size=44, label_size=15, name=None):
    return box(slide, x, y, w, h, color=bg, name=name, anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER,
               paras=[{"t": big, "size": big_size, "bold": True, "color": color, "after": 0},
                      {"t": label, "size": label_size, "color": DARK, "after": 0}])


def photo_slot(slide, x, y, w, h, msg, name):
    return box(slide, x, y, w, h, color=LGREY, line=GREY, dash=MSO_LINE_DASH_STYLE.DASH, radius=0.03,
               name=name, anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER,
               paras=[{"t": "VLOŽ FOTO", "size": 14, "bold": True, "color": GREY, "after": 2},
                      {"t": msg, "size": 12, "color": GREY, "after": 0}])


# ---------- 2: titulní snímek ----------
s = S[1]
for sh in s.shapes:
    if sh.name == "Nadpis 1":
        ps = sh.text_frame.paragraphs
        ps[0].runs[0].text = "Únik chloru v přístavu Aqaba"
        ps[1].runs[0].text = "Jordánsko, 27. června 2022"
    elif sh.name == "Podnadpis 2":
        sh.text_frame.paragraphs[0].runs[0].text = "Šimon Rákoš, listopad 2026"
        sh.width = Emu(4300000)
notes(s, "Představení tématu: havárie v jordánském přístavu Aqaba 27. 6. 2022. "
         "Při nakládce na loď spadla z jeřábu cisterna s asi 25 tunami zkapalněného chloru a roztrhla se.")

# ---------- 3: úvod ----------
s = S[2]
set_title(s, "Co se stalo v Aqabě")
facts = [("Kdy", "27. června 2022"),
         ("Kde", "přístav Aqaba, Jordánsko (Rudé moře)"),
         ("Látka", "chlor (Cl₂), zkapalněný pod tlakem"),
         ("Zařízení", "ISO cisterna (tlaková nádoba) s ≈ 25 t chloru"),
         ("Událost", "při nakládce na loď se přetrhlo vázací lano, cisterna spadla a roztrhla se")]
y = 2.15
for k, v in facts:
    text(s, 0.45, y, 1.55, 0.7, [{"t": k, "bold": True, "color": ORANGE, "size": 18}], name=f"Fakt {k} – popisek")
    text(s, 2.0, y, 4.9, 0.8, [{"t": v, "size": 18}], name=f"Fakt {k} – hodnota")
    y += 0.86
stat(s, 7.45, 2.15, 2.6, 1.95, "13", "mrtvých", color=RED, bg=LOR, big_size=54, name="Stat mrtví")
stat(s, 10.3, 2.15, 2.6, 1.95, "250+", "zraněných", color=ORANGE, bg=LOR, big_size=54, name="Stat zranění")
stat(s, 7.45, 4.35, 5.45, 1.75, "≈ 25 t", "zkapalněného chloru v jedné cisterně", color=TEAL, big_size=48,
     name="Stat množství")
text(s, 7.45, 6.18, 5.45, 0.35, [{"t": "Počty obětí se ve zdrojích liší: 12–13 mrtvých, 251–300+ zraněných.",
                                  "size": 11, "color": GREY, "italic": True}], name="Poznámka ke zdrojům")
notes(s, "Shrnutí na úvod: kdy, kde, jaká látka a jaké zařízení. "
         "Jedna cisterna s 25 tunami chloru stačila na 13 mrtvých a stovky zraněných. "
         "Čísla se v jednotlivých zdrojích liší (prvotní zprávy 12 mrtvých, později 13; zranění 251 až 300+), proto je uvádím jako rozmezí.")

# ---------- 4: vlastnosti chloru ----------
s = S[3]
set_title(s, "Chlor: identifikace a vlastnosti")
text(s, 0.45, 1.95, 12.4, 0.4,
     [{"runs": [{"t": "Cl₂", "bold": True, "color": TEAL}, "   ·   CAS 7782-50-5   ·   ES 231-959-5   ·   indexové číslo 017-001-00-7"],
       "size": 16, "color": GREY}], name="Identifikace")
cards = [("Žlutozelený plyn", "štiplavý, dusivý zápach, cítit už při velmi nízké koncentraci"),
         ("≈ 2,5× těžší než vzduch", "drží se při zemi, plní prohlubně, paluby a podpalubí lodí"),
         ("Bod varu −34 °C", "převáží se jako zkapalněný plyn pod tlakem"),
         ("1 l kapaliny ≈ 460 l plynu", "při úniku se kapalina rychle odpaří na velký mrak"),
         ("Podporuje hoření", "sám nehoří, ale je silné oxidační činidlo; s řadou látek reaguje bouřlivě"),
         ("S vlhkostí tvoří HCl a HClO", "na vlhkých sliznicích vzniká kyselina, poleptá dýchací cesty a plíce")]
cw, ch, gx, gy = 3.95, 1.85, 0.27, 0.27
for i, (h, d) in enumerate(cards):
    cx = 0.45 + (i % 3) * (cw + gx)
    cy = 2.5 + (i // 3) * (ch + gy)
    box(s, cx, cy, cw, ch, color=LTEAL, name=f"Karta {i + 1}", anchor=MSO_ANCHOR.MIDDLE,
        paras=[{"t": h, "size": 22, "bold": True, "color": TEAL_D, "after": 6},
               {"t": d, "size": 15, "color": DARK, "after": 0}], margin=0.2)
notes(s, "Základní vlastnosti chloru, které vysvětlují, proč byl únik tak nebezpečný: "
         "plyn je těžší než vzduch, takže se držel při zemi u lidí na molu a na lodi. "
         "Převáží se zkapalněný, a z jednoho litru kapaliny vznikne zhruba 460 litrů plynu – 25 tun kapaliny tak dalo obrovský mrak. "
         "Chlor sám nehoří, ale je to oxidant. S vodou na sliznicích tvoří kyselinu chlorovodíkovou a chlornou.")

# ---------- 5: klasifikace ----------
s = S[4]
set_title(s, "Chlor: klasifikace podle nařízení CLP")
rows = [["H-věta", "Znění", "Třída, kategorie"],
        [{"t": "H270", "bold": True}, "Může způsobit nebo zesílit požár; oxidant", "Ox. Gas 1"],
        [{"t": "H280", "bold": True}, "Obsahuje plyn pod tlakem; při zahřívání může vybuchnout", "Press. Gas"],
        [{"t": "H331*", "bold": True}, "Toxický při vdechování", "Acute Tox. 3"],
        [{"t": "H315", "bold": True}, "Dráždí kůži", "Skin Irrit. 2"],
        [{"t": "H319", "bold": True}, "Způsobuje vážné podráždění očí", "Eye Irrit. 2"],
        [{"t": "H335", "bold": True}, "Může způsobit podráždění dýchacích cest", "STOT SE 3"],
        [{"t": "H400", "bold": True}, "Vysoce toxický pro vodní organismy", "Aquatic Acute 1 (M = 100)"]]
table(s, 0.45, 2.0, 7.9, rows, [1.0, 4.45, 2.45], size=14, row_h=0.47, name="Tabulka H-vět")
text(s, 0.45, 5.9, 7.9, 0.75,
     [{"t": "* Harmonizovaná klasifikace EU je minimální. Výrobci (např. Linde, Air Liquide) uvádějí v bezpečnostních listech přísněji "
            "H330 – Při vdechování může způsobit smrt a H410 – Vysoce toxický pro vodní organismy, s dlouhodobými účinky.",
       "size": 12, "color": GREY, "italic": True}], name="Poznámka H330")
text(s, 8.75, 1.95, 4.2, 0.45, [{"runs": [{"t": "Signální slovo: ", "color": DARK},
                                          {"t": "NEBEZPEČÍ", "color": RED, "bold": True}], "size": 18,
                                 "align": PP_ALIGN.CENTER}], name="Signální slovo")
picts = [("ghs03", "GHS03", "oxidující"), ("ghs04", "GHS04", "plyn pod tlakem"),
         ("ghs06", "GHS06", "akutní toxicita"), ("ghs09", "GHS09", "životní prostředí")]
for i, (f, code, lab) in enumerate(picts):
    px = 8.95 + (i % 2) * 2.0
    py = 2.45 + (i // 2) * 1.75
    s.shapes.add_picture(f"{IMG}/{f}.png", In(px + 0.3), In(py), In(1.2), In(1.2)).name = f"Piktogram {code}"
    text(s, px - 0.1, py + 1.18, 2.0, 0.5, [{"runs": [{"t": code + " ", "bold": True}, {"t": lab}], "size": 13,
                                             "align": PP_ALIGN.CENTER}], name=f"Popisek {code}")
box(s, 8.75, 5.95, 4.2, 0.7, color=LOR, name="Vazba na zadání", anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER,
    paras=[{"runs": [{"t": "3 z 5 vlastností ze zadání: ", "bold": True},
                     {"t": "oxidující, toxický, nebezpečný pro ŽP"}], "size": 14, "after": 0}])
notes(s, "Klasifikace podle nařízení CLP (ES) č. 1272/2008. Chlor splňuje hned tři nebezpečné vlastnosti ze zadání: "
         "je oxidující (H270), toxický (H331) a nebezpečný pro životní prostředí (H400). "
         "Zajímavost: harmonizovaná klasifikace v příloze VI je jen minimální – výrobci v bezpečnostních listech uvádějí přísnější H330, "
         "tedy že při vdechování může způsobit smrt. "
         "OVĚŘIT: H-věty porovnat s aktuálním bezpečnostním listem (oddíl 2) a list uvést ve zdrojích.")

# ---------- 6: účinky ----------
s = S[5]
set_title(s, "Účinky chloru na člověka a limity")
rows = [["Koncentrace", "Účinek při vdechování"],
        ["0,2–0,4 ppm", "čichový práh – zápach je cítit"],
        ["1–3 ppm", "mírné dráždění očí, nosu a krku"],
        ["5–15 ppm", "středně silné dráždění horních cest dýchacích"],
        ["30 ppm", "okamžitá bolest na hrudi, kašel, dušnost, zvracení"],
        ["40–60 ppm", "zánět plic, plicní edém"],
        [{"t": "430 ppm", "bold": True, "color": RED}, {"t": "smrtelné při expozici 30 minut", "bold": True}],
        [{"t": "1 000 ppm", "bold": True, "color": RED}, {"t": "smrt během několika minut", "bold": True}]]
table(s, 0.45, 2.0, 7.4, rows, [1.75, 5.65], size=15, row_h=0.5, name="Tabulka účinků")
text(s, 0.45, 6.05, 7.4, 0.4, [{"t": "Zdroj hodnot: ATSDR, Medical Management Guidelines for Chlorine.", "size": 11,
                                "color": GREY, "italic": True}], name="Zdroj tabulky")
stat(s, 8.25, 2.0, 4.65, 1.25, "IDLH 10 ppm", "okamžitě nebezpečné pro život a zdraví (NIOSH)", color=RED, bg=LOR,
     big_size=30, label_size=14, name="IDLH")
box(s, 8.25, 3.45, 4.65, 1.45, color=LTEAL, name="Limity ČR", anchor=MSO_ANCHOR.MIDDLE, margin=0.2,
    paras=[{"t": "Limity v ČR (NV č. 361/2007 Sb.)", "size": 16, "bold": True, "color": TEAL_D, "after": 4},
           {"runs": [{"t": "PEL ", "bold": True}, "0,5 mg/m³   ·   ", {"t": "NPK-P ", "bold": True}, "1,5 mg/m³"],
            "size": 16, "after": 2},
           {"t": "1 ppm ≈ 2,9 mg/m³", "size": 13, "color": GREY, "after": 0}])
box(s, 8.25, 5.1, 4.65, 1.4, color=LTEAL, name="Životní prostředí", anchor=MSO_ANCHOR.MIDDLE, margin=0.2,
    paras=[{"t": "Životní prostředí", "size": 16, "bold": True, "color": TEAL_D, "after": 4},
           {"t": "vysoce toxický pro vodní organismy (M-faktor 100); ve vzduchu rychle reaguje s vlhkostí", "size": 14,
            "after": 0}])
notes(s, "Chlor působí hlavně při vdechování. Už desítky ppm způsobují plicní edém, stovky ppm zabíjejí. "
         "Pro srovnání: limit pro pracoviště v ČR je PEL 0,5 mg/m³, tedy zhruba 0,17 ppm. "
         "U roztržené cisterny s 25 tunami byly koncentrace v okolí o řády vyšší. "
         "OVĚŘIT: PEL a NPK-P v aktuálním znění přílohy 2 NV 361/2007 Sb.")

# ---------- 7: místo a zařízení (schéma) ----------
s = S[6]
set_title(s, "Místo a zařízení")
# scéna (zjednodušené schéma)
box(s, 0.45, 5.55, 6.3, 0.75, color=SEA, shape=MSO_SHAPE.RECTANGLE, name="Moře")
box(s, 0.45, 4.7, 1.75, 1.6, color=RGBColor(0xBF, 0xBF, 0xBF), shape=MSO_SHAPE.RECTANGLE, name="Molo",
    anchor=MSO_ANCHOR.BOTTOM, align=PP_ALIGN.CENTER, paras=[{"t": "molo", "size": 13, "color": DARK, "after": 2}])
hull = box(s, 2.45, 4.9, 4.3, 0.8, color=NAVY, shape=MSO_SHAPE.TRAPEZOID, name="Trup lodi")
hull.rotation = 180
box(s, 5.75, 4.05, 0.85, 0.85, color=NAVY, shape=MSO_SHAPE.RECTANGLE, name="Nástavba lodi")
text(s, 2.6, 5.72, 4.0, 0.4, [{"t": "loď MV Forest 6 → Džibutsko", "size": 13, "bold": True, "color": NAVY,
                               "align": PP_ALIGN.CENTER}], name="Popisek loď")
box(s, 1.5, 2.45, 0.16, 2.25, color=STEEL, shape=MSO_SHAPE.RECTANGLE, name="Sloup jeřábu")
conn(s, 1.58, 2.5, 4.45, 2.2, color=STEEL, w=5, name="Výložník jeřábu")
conn(s, 4.45, 2.2, 4.45, 2.85, color=STEEL, w=1.5, name="Lano kladkostroje")
box(s, 4.33, 2.85, 0.24, 0.18, color=STEEL, shape=MSO_SHAPE.RECTANGLE, name="Hák")
conn(s, 4.45, 3.03, 3.75, 3.55, color=RED, w=2.5, name="Vázací lano vlevo")
conn(s, 4.45, 3.03, 4.85, 3.33, color=RED, w=2.5, name="Vázací lano vpravo, část 1")
conn(s, 4.98, 3.43, 5.15, 3.55, color=RED, w=2.5, name="Vázací lano vpravo, část 2")
boom = box(s, 4.76, 3.22, 0.36, 0.32, color=RED, shape=MSO_SHAPE.EXPLOSION1, name="Místo přetržení")
box(s, 3.75, 3.55, 1.4, 0.8, color=None, line=STEEL, shape=MSO_SHAPE.RECTANGLE, line_w=2, name="Rám ISO cisterny")
can = box(s, 4.125, 3.3, 0.65, 1.3, color=CHLOR, shape=MSO_SHAPE.CAN, name="Nádrž s chlorem", line=STEEL, line_w=1)
can.rotation = 90
conn(s, 4.45, 4.42, 4.45, 4.85, color=RED, w=2, dash=MSO_LINE_DASH_STYLE.DASH, arrow=True, name="Šipka pádu")
text(s, 5.3, 2.55, 1.6, 0.85, [{"t": "vázací lano", "size": 13, "bold": True, "color": RED, "after": 0},
                               {"t": "nosnost ≈ 8,5 t", "size": 13, "color": RED}], name="Popisek lano")
text(s, 5.3, 3.5, 1.6, 0.6, [{"t": "ISO cisterna", "size": 13, "bold": True, "after": 0},
                             {"t": "≈ 28,9 t", "size": 13}], name="Popisek cisterna")
text(s, 0.45, 6.33, 6.3, 0.3, [{"t": "Zjednodušené schéma, není v měřítku.", "size": 11, "color": GREY, "italic": True}],
     name="Poznámka schéma")
# pravý sloupec
text(s, 7.2, 2.0, 5.7, 4.6,
     [{"t": "Přístav Aqaba", "size": 18, "bold": True, "color": TEAL_D, "after": 2},
      {"t": "jediný námořní přístav Jordánska, u města s cca 200 000 obyvateli", "size": 16, "bullet": True, "after": 10},
      {"t": "Náklad", "size": 18, "bold": True, "color": TEAL_D, "after": 2},
      {"t": "chlor od firmy National Chlorine Industries, určený do Džibutska", "size": 16, "bullet": True},
      {"t": "plán: naložit 18 cisteren, havárie při zvedání 5. cisterny", "size": 16, "bullet": True, "after": 10},
      {"t": "Zařízení", "size": 18, "bold": True, "color": TEAL_D, "after": 2},
      {"t": "ISO cisterna = tlaková nádoba v ocelovém rámu", "size": 16, "bullet": True},
      {"t": "zvedání jeřábem na ocelovém vázacím laně", "size": 16, "bullet": True}],
     name="Popis místa a zařízení")
notes(s, "Přístav Aqaba je jediný jordánský námořní přístav. Chlor vyráběla jordánská firma National Chlorine Industries a měl se vyvážet do Džibutska. "
         "Únik nastal ze zařízení: ISO cisterna je tlaková nádoba v ocelovém rámu, která se zvedala jeřábem na ocelovém vázacím laně. "
         "Schéma je zjednodušené – zdroje se úplně neshodují, zda šlo o jeřáb na molu, nebo na lodi. "
         "OVĚŘIT: počet obyvatel Aqaby a počet 18 plánovaných cisteren.")

# ---------- 8: průběh ----------
s = S[7]
set_title(s, "Průběh havárie")
steps = [("Nakládka", "Cisterny se zvedají jeřábem na loď, 4 proběhly bez problému"),
         ("Přetržení lana", "Při zvedání 5. cisterny praskne ocelové vázací lano"),
         ("Pád", "Cisterna s ≈ 25 t chloru dopadne na loď a praskne"),
         ("Toxický mrak", "Chlor se odpaří, žlutý mrak se valí po lodi a molu"),
         ("Zásah", "Evakuace přístavu, obyvatelé mají zůstat doma se zavřenými okny")]
sw = 2.48
conn(s, 0.45 + sw / 2, 2.35, 0.45 + 4 * sw + sw / 2, 2.35, color=TEAL, w=3, name="Osa času")
for i, (h, d) in enumerate(steps):
    cx = 0.45 + i * sw
    c = box(s, cx + sw / 2 - 0.3, 2.05, 0.6, 0.6, color=RED if i in (1, 2, 3) else TEAL, shape=MSO_SHAPE.OVAL,
            name=f"Krok {i + 1} – číslo", anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER, margin=0,
            paras=[{"t": str(i + 1), "size": 20, "bold": True, "color": WHITE, "after": 0}])
    text(s, cx + 0.05, 2.75, sw - 0.1, 1.5,
         [{"t": h, "size": 17, "bold": True, "color": TEAL_D, "align": PP_ALIGN.CENTER, "after": 3},
          {"t": d, "size": 14, "align": PP_ALIGN.CENTER}], name=f"Krok {i + 1} – text")
photo_slot(s, 0.45, 4.45, 3.9, 2.15, "snímek z kamerového záznamu: cisterna na laně", "Foto 1")
photo_slot(s, 4.6, 4.45, 3.9, 2.15, "snímek z kamerového záznamu: žlutý mrak", "Foto 2")
box(s, 8.8, 4.45, 4.1, 2.15, color=LOR, name="Odkaz na video", anchor=MSO_ANCHOR.MIDDLE, margin=0.2,
    paras=[{"t": "▶  Video z havárie", "size": 20, "bold": True, "color": ORANGE, "after": 6},
           {"t": "kamerový záznam pádu cisterny a úniku chloru:", "size": 14, "after": 4},
           {"runs": [{"t": "Seznam Zprávy (2022)",
                      "link": "https://www.seznamzpravy.cz/clanek/zahranicni-video-oranzovy-mrak-zahalil-lod-v-jordanskem-pristavu-unikl-toxicky-plyn-207637"}],
            "size": 14, "after": 2},
           {"runs": [{"t": "Khaleej Times (2022)",
                      "link": "https://www.khaleejtimes.com/world/mena/watch-12-dead-over-250-hospitalised-after-chlorine-gas-blast-at-jordans-aqaba-port"}],
            "size": 14, "after": 0}])
notes(s, "Průběh podle kamerového záznamu a zpráv: čtyři cisterny se naložily bez problému, při zvedání páté prasklo ocelové vázací lano. "
         "Cisterna spadla na loď, roztrhla se a kapalný chlor se okamžitě odpařil – na videu je vidět hustý žlutý mrak, který se valí po molu. "
         "Úřady uzavřely okolí přístavu a obyvatelé Aqaby dostali pokyn zůstat doma se zavřenými okny. "
         "DOPLNIT: dva snímky z videa místo šedých rámečků (pravým tlačítkem na rámeček > Změnit tvar nebo ho smazat a vložit obrázek).")

# ---------- 9: příčiny ----------
s = S[8]
set_title(s, "Příčiny havárie")
cd = CategoryChartData()
cd.categories = ["Hmotnost cisterny", "Nosnost vázacího lana"]
cd.add_series("Tuny", (28.9, 8.5))
gf = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, In(0.45), In(2.45), In(5.9), In(3.2), cd)
gf.name = "Graf nosnost vs hmotnost"
ch = gf.chart
ch.has_legend = False
ch.has_title = False
ch.font.name = "Calibri"
ch.font.size = Pt(14)
ch.font.color.rgb = DARK
pl = ch.plots[0]
pl.gap_width = 60
pl.has_data_labels = True
dl = pl.data_labels
dl.number_format = '0.0" t"'
dl.number_format_is_linked = False
dl.position = XL_LABEL_POSITION.OUTSIDE_END
dl.font.size = Pt(18)
dl.font.bold = True
ser = pl.series[0]
for idx, col in ((0, ORANGE), (1, TEAL)):
    pt = ser.points[idx]
    pt.format.fill.solid()
    pt.format.fill.fore_color.rgb = col
va = ch.value_axis
va.maximum_scale = 35
va.minimum_scale = 0
va.has_major_gridlines = False
va.visible = False
ca = ch.category_axis
ca.format.line.color.rgb = RGBColor(0xBF, 0xBF, 0xBF)
ca.tick_labels.font.size = Pt(15)
text(s, 0.45, 1.95, 5.9, 0.5, [{"runs": [{"t": "Přímá příčina: ", "bold": True, "color": RED},
                                         {"t": "lano bylo přetížené ≈ 3,4×"}], "size": 18}], name="Přímá příčina")
text(s, 0.45, 5.7, 5.9, 0.9, [{"t": "Údaje z předběžných zjištění vyšetřovací komise (ICHCA, 20. 7. 2022).",
                               "size": 11, "color": GREY, "italic": True}], name="Zdroj grafu")
text(s, 6.85, 1.95, 6.05, 0.5, [{"t": "Systémové příčiny podle vyšetřovací komise", "size": 18, "bold": True,
                                 "color": TEAL_D}], name="Nadpis systémové příčiny")
causes = [("Nedodržované postupy", "bezpečnostní postupy pro manipulaci s nebezpečnými chemickými látkami se nedodržovaly"),
          ("Chybějící informace", "komunikace o nebezpečí byla neformální, pracovníci neznali hmotnost ani obsah cisteren"),
          ("Nevyškolení lidé", "vedení přístavu svěřovalo úkoly nevyškoleným pracovníkům"),
          ("Špatné vázací prostředky", "lano neodpovídalo hmotnosti břemene a nikdo to nekontroloval")]
y = 2.5
for i, (h, d) in enumerate(causes):
    box(s, 6.85, y + 0.1, 0.55, 0.55, color=ORANGE, shape=MSO_SHAPE.OVAL, name=f"Příčina {i + 1} – číslo",
        anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER, margin=0,
        paras=[{"t": str(i + 1), "size": 18, "bold": True, "color": WHITE, "after": 0}])
    text(s, 7.55, y, 5.35, 0.95, [{"t": h, "size": 16, "bold": True, "after": 1},
                                  {"t": d, "size": 14, "color": DARK}], name=f"Příčina {i + 1} – text")
    y += 1.02
notes(s, "Přímá příčina byla jednoduchá: vázací lano s nosností asi 8,5 tuny zvedalo cisternu o hmotnosti asi 28,9 tuny, tedy přetížení zhruba 3,4×. "
         "Vyšetřovací komise ale ukázala i systémové příčiny: nedodržované postupy, neformální předávání informací – lidé nevěděli, co a kolik zvedají – "
         "a nevyškolený personál. Žádná kontrola nezachytila, že lano na takové břemeno nestačí. "
         "Údaje o nosnosti a hmotnosti jsou z předběžných zjištění, konečnou zprávu se dohledat nepodařilo.")

# ---------- 10: následky ----------
s = S[9]
set_title(s, "Následky")
stat(s, 0.45, 2.0, 3.95, 2.05, "13", "mrtvých", color=RED, bg=LOR, big_size=54, name="Stat mrtví")
stat(s, 4.69, 2.0, 3.95, 2.05, "250+", "zraněných a ošetřených", color=ORANGE, bg=LOR, big_size=54, name="Stat zranění")
stat(s, 8.93, 2.0, 3.95, 2.05, "≈ 20 t", "chloru uniklo do ovzduší", color=TEAL, bg=LTEAL, big_size=54, name="Stat únik")
cols = [("Lidé", ["oběti hlavně mezi pracovníky přístavu, mezi nimi 5 cizinců (Vietnam)",
                  "poleptání dýchacích cest, část zraněných v kritickém stavu"]),
        ("Majetek a provoz", ["zničená cisterna, přerušený provoz přístavu",
                              "stávka přístavních dělníků, kteří žádali lepší bezpečnost"]),
        ("Životní prostředí", ["chlor se rozptýlil do ovzduší nad přístavem a mořem",
                               "o dlouhodobých škodách zdroje nepíšou"])]
for i, (h, items) in enumerate(cols):
    x = 0.45 + i * 4.24
    text(s, x, 4.4, 3.95, 2.2, [{"t": h, "size": 20, "bold": True, "color": TEAL_D, "after": 6}] +
         [{"t": it, "size": 17, "bullet": True, "after": 6} for it in items], name=f"Následky – {h}")
notes(s, "Následky na lidech: 13 mrtvých, mezi nimi pět Vietnamců, a přes 250 zraněných. "
         "Na majetku: zničená cisterna a přerušený provoz jediného jordánského přístavu, následovala stávka dělníků. "
         "K dopadu na životní prostředí jsem podrobné informace nenašel – chlor se rozptýlil do ovzduší. "
         "OVĚŘIT: množství uniklého chloru (zdroje uvádějí ≈ 20 t) a národnost obětí.")

# ---------- 11: opatření ----------
s = S[10]
set_title(s, "Přijatá opatření")
text(s, 0.45, 1.95, 6.2, 0.5, [{"t": "Co udělaly úřady a přístav", "size": 18, "bold": True, "color": TEAL_D}],
     name="Nadpis úřady")
acts = [("3. 7. 2022", "vládní komise (více než 120 svědků): „nedbalost a závažné nedostatky v bezpečnosti“"),
        ("Odvolání", "generální ředitel provozovatele přístavu a vedení Jordánské námořní komise"),
        ("Soud", "5 lidí odsouzeno na 3 roky vězení, firma pokutována 3 000 JOD"),
        ("Zákaz", "nový přístav přestal přijímat nebezpečné náklady a vyvážet zkapalněný chlor"),
        ("Pracovníci", "po stávce slíbena další bezpečnostní opatření v terminálech")]
y = 2.5
for h, d in acts:
    text(s, 0.45, y, 1.55, 0.8, [{"t": h, "size": 15, "bold": True, "color": ORANGE}], name=f"Opatření {h} – popisek")
    text(s, 2.0, y, 4.65, 0.8, [{"t": d, "size": 15}], name=f"Opatření {h} – text")
    y += 0.8
box(s, 7.0, 1.95, 5.9, 4.65, color=LTEAL, name="Poučení pro praxi", margin=0.25,
    paras=[{"t": "Co z havárie plyne pro praxi", "size": 18, "bold": True, "color": TEAL_D, "after": 10},
           {"t": "znát hmotnost a obsah břemene ještě před zvedáním", "size": 16, "bullet": True, "char": "✓",
            "bucolor": TEAL, "after": 8},
           {"t": "používat vázací prostředky s ověřenou a označenou nosností", "size": 16, "bullet": True, "char": "✓",
            "bucolor": TEAL, "after": 8},
           {"t": "mít písemný plán zvedání pro nebezpečné náklady", "size": 16, "bullet": True, "char": "✓",
            "bucolor": TEAL, "after": 8},
           {"t": "předávat informace o nebezpečném nákladu formálně a prokazatelně", "size": 16, "bullet": True,
            "char": "✓", "bucolor": TEAL, "after": 8},
           {"t": "školit obsluhu a vázače, nikoho nepouštět pod břemeno", "size": 16, "bullet": True, "char": "✓",
            "bucolor": TEAL, "after": 8},
           {"t": "mít připravený havarijní plán pro únik toxického plynu", "size": 16, "bullet": True, "char": "✓",
            "bucolor": TEAL, "after": 0}])
notes(s, "Reakce úřadů: vyšetřovací komise 3. 7. 2022 zveřejnila předběžné závěry, vláda odvolala vedení provozovatele přístavu a námořní komise. "
         "Soud později odsoudil pět lidí na tři roky vězení a firma dostala pokutu 3 000 jordánských dinárů (datum rozsudku zdroje neuvádějí). "
         "Přístav přestal přijímat nebezpečné náklady. "
         "Nové celostátní předpisy jsem nenašel – pravý sloupec proto shrnuje obecné zásady bezpečného zvedání, které z havárie plynou.")

# ---------- 12: závěr ----------
s = S[11]
set_title(s, "Závěr")
box(s, 0.45, 2.0, 12.45, 1.3, color=LOR, name="Hlavní sdělení", anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER,
    paras=[{"runs": [{"t": "Jedno přetížené lano", "bold": True, "color": ORANGE}, "  +  ",
                     {"t": "25 t toxického plynu", "bold": True, "color": TEAL_D}, "  =  ",
                     {"t": "13 mrtvých", "bold": True, "color": RED}], "size": 28, "after": 0}])
lessons = [("Nebezpečí není jen ve výrobě", "nebezpečné látky jsou zranitelné i při manipulaci a nakládce, ne jen v reaktorech a potrubí"),
           ("Technika selhala kvůli organizaci", "chyběly postupy, informace o nákladu a školení – lano bylo jen poslední článek"),
           ("Tlakové cisterny = zařízení", "u toxických plynů platí stejná pravidla: znát hmotnost, plán zvedání, ověřené vázací prostředky")]
for i, (h, d) in enumerate(lessons):
    x = 0.45 + i * 4.24
    box(s, x, 3.6, 3.95, 2.55, color=LTEAL, name=f"Poučení {i + 1}", margin=0.22,
        paras=[{"t": str(i + 1), "size": 36, "bold": True, "color": TEAL, "after": 2},
               {"t": h, "size": 18, "bold": True, "color": TEAL_D, "after": 6},
               {"t": d, "size": 15, "after": 0}])
notes(s, "Závěr v jedné větě: přetížené lano a velké množství toxického plynu stačily na katastrofu. "
         "Hlavní poučení: rizika nebezpečných látek nejsou jen ve výrobních technologiích, ale i při manipulaci; "
         "technické selhání mělo organizační příčiny; a tlakové cisterny s toxickými plyny vyžadují stejnou disciplínu jako provozní zařízení.")

# ---------- 13: zdroje ----------
s = S[12]
set_title(s, "Použitá literatura a zdroje")
C = "[cit. 2026-11-05]"
refs1 = [
    f"ICHCA INTERNATIONAL. Safety Alert: Aqaba Chlorine Tank Incident. Online. 20. 7. 2022. Dostupné z: https://ichca.com/wp-content/uploads/2022/07/Safety-Alert-Aqaba-Chlorine-Tank-Incident-.pdf. {C}",
    f"IChemE. Loss Prevention Bulletin, č. 303. Online. Dostupné z: https://www.icheme.org/media/28639/lpb303_pg02.pdf. {C}",
    f"AIChE. Process Safety Beacon: Lifting Hazards. Online. Chemical Engineering Progress, duben 2023. Dostupné z: https://www.aiche.org/resources/publications/cep/2023/april/process-safety-beacon-lifting-hazards. {C}",
    f"VOICE OF AMERICA. Jordan: Negligence Caused Aqaba Chlorine Tank Explosion. Online. 2022. Dostupné z: https://www.voanews.com/a/jordan-negligence-responsible-for-aqaba-chlorine-tank-explosion-/6644453.html. {C}",
    f"THE MARITIME EXECUTIVE. Jordan Dismisses Port Officials Over Deadly Chlorine Gas Accident. Online. 2022. Dostupné z: https://maritime-executive.com/index.php/article/jordan-dismisses-port-officials-over-deadly-chorine-gas-accident. {C}",
    f"THE MEDIA LINE. 5 Sentenced Over Fatal 2022 Chlorine Gas Leak at Jordan’s Aqaba Port. Online. Dostupné z: https://themedialine.org/headlines/5-sentenced-over-fatal-2022-chlorine-gas-leak-at-jordans-aqaba-port. {C}",
    f"JORDAN NEWS. Aqaba New Port will no longer handle ‘dangerous materials’. Online. Dostupné z: https://jordannews.jo/Section-109/News/Aqaba-New-Port-will-no-longer-handle-dangerous-materials-20044. {C}",
    f"EURONEWS. Jordan port workers suspend work to protest deaths in chlorine gas leak. Online. 4. 7. 2022. Dostupné z: https://www.euronews.com/2022/07/04/us-jordan-aqaba-ports. {C}",
]
refs2 = [
    f"NOVINKY.CZ. V jordánském přístavu unikl po nehodě chlor: 13 mrtvých a 251 zraněných. Online. 2022. Dostupné z: https://novinky.cz/zahranicni/blizky-a-stredni-vychod/clanek/v-jordanskem-pristavu-unikl-po-nehode-chlor-13-mrtvych-a-251-zranenych-40401430. {C}",
    f"SEZNAM ZPRÁVY. Video: Oranžový mrak zahalil loď, v jordánském přístavu unikl toxický plyn. Online. 2022. Dostupné z: https://www.seznamzpravy.cz/clanek/zahranicni-video-oranzovy-mrak-zahalil-lod-v-jordanskem-pristavu-unikl-toxicky-plyn-207637. {C}",
    f"BOZPFORUM.CZ. Smrtící únik chloru v jordánském přístavu Aqaba. Online. 27. 6. 2022. Dostupné z: https://www.bozpforum.cz/2022/06/27/smrtici-unik-chloru-v-jordanskem-pristavu-aqaba/. {C}",
    f"LINDE GAS A.S. Bezpečnostní list: Chlór. Verze 3.0. Online. Dostupné z: https://static.prd.echannel.linde.com/wcsstore/CZ_RME_Industrial_Gas_Store/Linde/BLaDL/BL/BL-Chl%C3%B3r-v3.0.pdf. {C}",
    f"ATSDR. Medical Management Guidelines for Chlorine. Online. Atlanta: CDC. Dostupné z: https://wwwn.cdc.gov/TSP/MMG/MMGDetails.aspx?mmgid=685&toxid=36. {C}",
    f"NIOSH. Pocket Guide to Chemical Hazards: Chlorine. Online. Dostupné z: https://www.cdc.gov/niosh/npg/npgd0115.html. {C}",
    "Nařízení Evropského parlamentu a Rady (ES) č. 1272/2008 o klasifikaci, označování a balení látek a směsí (CLP), příloha VI.",
    "Nařízení vlády č. 361/2007 Sb., kterým se stanoví podmínky ochrany zdraví při práci, příloha č. 2.",
]
for col, refs in ((0, refs1), (1, refs2)):
    text(s, 0.45 + col * 6.3, 1.95, 6.1, 4.75,
         [{"t": r, "size": 10, "after": 5} for r in refs], name=f"Zdroje sloupec {col + 1}", line=0.95)
notes(s, "Zdroje ve formátu ČSN ISO 690. Datum citace upravit podle skutečného data odevzdání. "
         "Bezpečnostní list Linde otevřít a zkontrolovat, že odkaz funguje.")

# ---------- 14: závěrečný snímek ----------
s = S[13]
for sh in s.shapes:
    if sh.name == "Obdélník 4":
        ps = sh.text_frame.paragraphs
        ps[0].runs[0].text = "Děkuji za pozornost"
        ps[1].runs[0].text = "Šimon Rákoš"
        ps[2].runs[0].text = "[e-mail] · [studijní program]"
        for r in ps[0].runs:
            r.font.color.rgb = ORANGE
        for r in ps[2].runs:
            r.font.size = Pt(24)
            r.font.bold = False

prs.save(OUT)
print("saved", OUT)
