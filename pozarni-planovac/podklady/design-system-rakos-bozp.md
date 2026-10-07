# Design systém „Rákoš BOZP“ – zadání pro artifacty

## ČÁST A – Instrukce projektu (vložit do „Project instructions“)

Všechny artifacty (webové stránky, dashboardy, přehledy, nabídky, aplikace, interaktivní nástroje) navrhuj v design systému **Rákoš BOZP**. Je to čistý a důvěryhodný styl: světlé šedomodré plochy, bílé karty, námořnické písmo, tyrkysový akcent a jemná technická mřížka. Celý podklad s CSS je v souboru znalostí `design-system-rakos-bozp.md`. Používej ho vždy, i když o to výslovně nežádám.

**Povinně:**
1. Do každého HTML artifactu vlož CSS proměnné a styly komponent z části C (beze změny hodnot). Barvy, mezery, rohy a stíny piš jen přes proměnné `var(--…)`, nikdy jako vlastní hex.
2. Písma načti přes `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">`. Nadpisy jsou Plus Jakarta Sans 800 s těsným prostrkáním, text je Inter.
3. Výchozí je světlé téma. Tmavé se zapíná samo podle systému nebo přes `data-theme="dark"` na `<html>`.
4. Každá sekce začíná stejně: nadtitulek (`.rk-eyebrow`, tyrkysové verzálky s linkou), velký nadpis a perex v šedé.
5. Obsah skládej do bílých karet (`.rk-card`) s ikonovou dlaždicí (`.rk-tile`) v mřížce 3–4 sloupců s mezerou 16 px.
6. V sekci je jen jedno tyrkysové tlačítko (`.rk-btn--primary`, text tmavý). Druhá akce je `.rk-btn--secondary` (bílé) nebo `.rk-btn--dark` (námořnické).
7. Hlavní výzva stránky patří do tmavého panelu s mřížkou (`.rk-callout`), nejvýš jednoho na stránku.
8. Stavy (splněno / pozor / po termínu) jsou vždy slovo + barva + ikona, nikdy jen barva.
9. Ikony jsou lineární SVG 24×24, tah 1,75, zaoblené konce, `stroke="currentColor"` (styl Lucide). Žádné emoji.
10. Rozvržení musí fungovat na mobilu: šířka 360 px, okraj 16 px, bez vodorovného posunu.

**Zakázáno:** fialovo-modré přechody, neonové záře, sklo, emoji, karty s barevným levým okrajem, tyrkysová `--accent` jako barva textu na bílé (na text je `--accent-ink`), víc než jedno tyrkysové tlačítko v sekci, text na střed v delších odstavcích.

**Texty:** česky, 1. osoba za mě jako OSVČ („Prověřím“, „Pomáhám firmám“), vykání klientovi. Nadpisy jsou tvrzení s přínosem, tlačítka říkají, co klient dostane („Poptat nezávaznou konzultaci“, „Chci vstupní audit“). Předpisy uváděj přesně („§ 101 zákoníku práce“, „zákon č. 258/2000 Sb.“). Bez vykřičníků a strašení pokutami.

---

## ČÁST B – Pravidla vzhledu (podrobně)

### Barvy (tokeny)
| Token | Světlý | Tmavý | Použití |
|---|---|---|---|
| `--bg-000` | #f8fafc | #0b1120 | pozadí stránky, střídané sekce |
| `--bg-100` | #ffffff | #111a2e | karty, bílé sekce, navigace |
| `--bg-300` | #f1f5f9 | #1e293b | hover, neutrální štítek |
| `--line` | #e2e8f0 | #243049 | okraje karet, oddělovače |
| `--ink` | #0f172a | #f1f5f9 | nadpisy, hlavní text |
| `--ink-muted` | #475569 | #a3b0c2 | perexy, popisy |
| `--accent` | #06b6d4 | #22d3ee | výplň hlavního tlačítka (text `--on-accent`) |
| `--accent-ink` | #0e7490 | #22d3ee | tyrkysový TEXT: nadtitulky, odkazy, předpisy |
| `--accent-soft` | #ecfeff | #10283a | pozadí ikonových dlaždic |
| `--inverse` | #0f172a | #f1f5f9 | námořnické tlačítko, dlaždice loga |
| `--deep` | #0f172a | #16213a | tmavý panel výzvy |
| `--ok` / `--warn` / `--danger` | #047857 / #b45309 / #b91c1c | #34d399 / #fbbf24 / #f87171 | stavy (+ varianta `-soft` na pozadí) |

Kontrast: všechny textové páry splňují WCAG AA (4,5:1) v obou tématech.

### Typografie
- `display` 64 px / 1.02 / 800 / −0,035 em (hero; na mobilu 40 px)
- `h1` 48 / 1.08 / 800; `h2` 36 / 1.1 / 800; nadpis karty 18–20 / 700 (vše Plus Jakarta Sans)
- `eyebrow` 13 px / 700 / VERZÁLKY / +0,08 em / `--accent-ink` s linkou 28 px vlevo
- `lead` 18 / 1.6; `body` 16 / 1.6; `body-sm` 14 / 1.6; `ref` (předpis) 12 / 500 (vše Inter)
- Nadpisy `text-wrap: balance`, perex max. ~60 znaků na řádek

### Prostor a tvary
- Mezery: 4 · 8 · 12 · 16 · 24 · 40 · 64 · 112 px (`--space-1` až `--space-8`). Sekce svisle 112 px, uvnitř karty 24 px, mezi kartami 16 px. Obsah max. 1200 px na střed.
- Rohy: tlačítka, pole a dlaždice 8 px; karty 12 px; tmavý panel a obrázky 16 px; štítek s tečkou a přepínač mají plně zaoblené konce.
- Stíny jemné: `--shadow-sm` v klidu, `--shadow-md` při hoveru a u plovoucích prvků, `--shadow-accent` pod tyrkysovým tlačítkem na tmavém panelu.

### Typická stavba webové stránky
1. Navigace: bílá lišta, logo vlevo (námořnická dlaždice se štítem + „BOZP+PO“), odkazy uprostřed, tyrkysové tlačítko vpravo.
2. Hero na `--bg-000` s mřížkou (`.rk-gridbg`). Vlevo štítek s tečkou (`.rk-badge--pill`), nadpis, perex, tlačítka `primary` + `secondary` a pod linkou řada služeb s ikonami. Vpravo obrázek s plovoucím bílým štítkem.
3. Služby: nadtitulek, nadpis a mřížka 3 karet s ikonou a odkazem „Zjistit více →“.
4. Tmavý panel `.rk-callout` s výzvou a kroky (Audit → Zjištění → Náprava → Pravidelná péče).
5. Proces, legislativa (karty s odkazem na předpis nad nadpisem), FAQ, kontakt.

### Interakce
- Hover: karta se zvedne o 3 px a dostane `--shadow-md`, šipka se posune o 3 px, hlavní tlačítko ztmavne a dostane tyrkysový stín.
- Fokus z klávesnice: 2px obrys `--focus`. Pole při fokusu dostane tyrkysový okraj a světlou záři.
- Přechody 180–250 ms ease. Respektuj `prefers-reduced-motion`.

---

## ČÁST C – CSS (vložit do každého HTML artifactu)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
```

```css
/* === Tokeny === */
:root {
  --bg-000: #f8fafc;
  --bg-100: #ffffff;
  --bg-200: #ffffff;
  --bg-300: #f1f5f9;
  --line: #e2e8f0;
  --line-strong: #7c8a9e;
  --ink: #0f172a;
  --ink-muted: #475569;
  --ink-subtle: #64748b;
  --accent: #06b6d4;
  --accent-hover: #0ea5c6;
  --on-accent: #0f172a;
  --accent-ink: #0e7490;
  --accent-soft: #ecfeff;
  --inverse: #0f172a;
  --on-inverse: #ffffff;
  --deep: #0f172a;
  --deep-raised: #1a2438;
  --deep-line: #26324a;
  --on-deep: #f8fafc;
  --on-deep-muted: #b4c0d0;
  --on-deep-accent: #22d3ee;
  --focus: #0e7490;
  --ok: #047857;
  --ok-dot: #10b981;
  --ok-soft: #ecfdf5;
  --warn: #b45309;
  --warn-soft: #fffbeb;
  --danger: #b91c1c;
  --danger-soft: #fef2f2;
  --shadow-sm: 0 1px 2px #0f172a0a;
  --shadow-md: 0 12px 32px -12px #0f172a26;
  --shadow-accent: 0 8px 24px -8px #06b6d48c;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 40px;
  --space-7: 64px;
  --space-8: 112px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 999px;
  --font-display: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --font-sans: Inter, "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg-000: #0b1120;
    --bg-100: #111a2e;
    --bg-200: #16213a;
    --bg-300: #1e293b;
    --line: #243049;
    --line-strong: #62728e;
    --ink: #f1f5f9;
    --ink-muted: #a3b0c2;
    --ink-subtle: #8391a7;
    --accent: #22d3ee;
    --accent-hover: #67e8f9;
    --on-accent: #0b1120;
    --accent-ink: #22d3ee;
    --accent-soft: #10283a;
    --inverse: #f1f5f9;
    --on-inverse: #0f172a;
    --deep: #16213a;
    --deep-raised: #1e2a45;
    --deep-line: #2e3b58;
    --on-deep: #f8fafc;
    --on-deep-muted: #b4c0d0;
    --on-deep-accent: #22d3ee;
    --focus: #22d3ee;
    --ok: #34d399;
    --ok-dot: #34d399;
    --ok-soft: #0f2a22;
    --warn: #fbbf24;
    --warn-soft: #2d2410;
    --danger: #f87171;
    --danger-soft: #2f1515;
    --shadow-sm: 0 1px 2px #00000040;
    --shadow-md: 0 12px 32px -12px #00000099;
    --shadow-accent: 0 8px 24px -8px #22d3ee66;
  }
}
:root[data-theme="dark"] {
  --bg-000: #0b1120;
  --bg-100: #111a2e;
  --bg-200: #16213a;
  --bg-300: #1e293b;
  --line: #243049;
  --line-strong: #62728e;
  --ink: #f1f5f9;
  --ink-muted: #a3b0c2;
  --ink-subtle: #8391a7;
  --accent: #22d3ee;
  --accent-hover: #67e8f9;
  --on-accent: #0b1120;
  --accent-ink: #22d3ee;
  --accent-soft: #10283a;
  --inverse: #f1f5f9;
  --on-inverse: #0f172a;
  --deep: #16213a;
  --deep-raised: #1e2a45;
  --deep-line: #2e3b58;
  --on-deep: #f8fafc;
  --on-deep-muted: #b4c0d0;
  --on-deep-accent: #22d3ee;
  --focus: #22d3ee;
  --ok: #34d399;
  --ok-dot: #34d399;
  --ok-soft: #0f2a22;
  --warn: #fbbf24;
  --warn-soft: #2d2410;
  --danger: #f87171;
  --danger-soft: #2f1515;
  --shadow-sm: 0 1px 2px #00000040;
  --shadow-md: 0 12px 32px -12px #00000099;
  --shadow-accent: 0 8px 24px -8px #22d3ee66;
}

/* === Komponenty === */
.rk-card__body, .rk-sh__lead { text-wrap: pretty; }
body { margin: 0; font-family: var(--font-sans); font-size: 16px; line-height: 1.6; background: var(--bg-000); color: var(--ink); -webkit-font-smoothing: antialiased; }
.rk-row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; padding: var(--space-5); }
.rk-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4); padding: var(--space-5); }
/* Optional page backdrop: the faint blueprint grid behind the hero */
.rk-gridbg { background-color: var(--bg-000); background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 48px 48px; background-position: -1px -1px; }
:where(.rk-btn, .rk-card--interactive, .rk-switch__track, .rk-tabs__tab, .rk-alert__close, .rk-steps__card):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* Icon tile */
.rk-tile { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--accent-soft); color: var(--accent-ink); flex: none; }
.rk-tile--sm { width: 28px; height: 28px; border-radius: var(--radius-sm); }

/* Eyebrow + SectionHeader */
.rk-eyebrow { display: inline-flex; align-items: center; gap: 10px; font: 700 13px/1.2 var(--font-display); letter-spacing: .08em; text-transform: uppercase; color: var(--accent-ink); }
.rk-eyebrow::before { content: ""; width: 28px; height: 1px; background: currentColor; opacity: .7; }
.rk-sh { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3); max-width: 720px; }
.rk-sh--center { align-items: center; text-align: center; margin: 0 auto; }
.rk-sh__title { margin: 0; font: 800 48px/1.08 var(--font-display); letter-spacing: -.03em; color: var(--ink); text-wrap: balance; }
.rk-sh__title--lg { font-size: 64px; line-height: 1.02; letter-spacing: -.035em; }
.rk-sh__title--sm { font-size: 36px; line-height: 1.1; }
.rk-sh__lead { margin: var(--space-1) 0 0; font-size: 18px; line-height: 1.6; color: var(--ink-muted); max-width: 60ch; }
.rk-sh--dark .rk-eyebrow { color: var(--on-deep-accent); }
.rk-sh--dark .rk-sh__title { color: var(--on-deep); }
.rk-sh--dark .rk-sh__lead { color: var(--on-deep-muted); }
@media (max-width: 640px) { .rk-sh__title { font-size: 32px; } .rk-sh__title--lg { font-size: 40px; } .rk-sh__title--sm { font-size: 28px; } }

/* Button */
.rk-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font: 600 14px/1 var(--font-sans); height: 44px; padding: 0 var(--space-5); border-radius: var(--radius-md); border: 1px solid transparent; cursor: pointer; text-decoration: none; white-space: nowrap; transition: background-color .18s ease, border-color .18s ease, box-shadow .2s ease, transform .18s ease, color .18s ease; }
.rk-btn:active:not(:disabled) { transform: translateY(1px); }
.rk-btn:disabled { opacity: .45; cursor: not-allowed; }
.rk-btn--sm { height: 36px; padding: 0 var(--space-4); font-size: 13px; }
.rk-btn--lg { height: 52px; padding: 0 28px; font-size: 15px; }
.rk-btn--block { display: flex; width: 100%; }
.rk-btn__arrow { display: inline-flex; transition: transform .25s ease; }
.rk-btn:hover:not(:disabled) .rk-btn__arrow { transform: translateX(3px); }
.rk-btn--primary { background: var(--accent); color: var(--on-accent); }
.rk-btn--primary:hover:not(:disabled) { background: var(--accent-hover); box-shadow: var(--shadow-accent); }
.rk-btn--dark { background: var(--inverse); color: var(--on-inverse); }
.rk-btn--dark:hover:not(:disabled) { box-shadow: var(--shadow-md); }
.rk-btn--secondary { background: var(--bg-100); color: var(--ink); border-color: var(--line); box-shadow: var(--shadow-sm); }
.rk-btn--secondary:hover:not(:disabled) { border-color: var(--line-strong); background: var(--bg-300); }
.rk-btn--link { height: auto; padding: 0; background: none; color: var(--accent-ink); font-size: 14px; gap: 6px; }
.rk-btn--link:hover:not(:disabled) { text-decoration: underline; text-underline-offset: 3px; }
.rk-btn--danger { background: var(--danger-soft); color: var(--danger); border-color: var(--danger-soft); }
.rk-btn--danger:hover:not(:disabled) { border-color: var(--danger); }

/* Badge */
.rk-badge { display: inline-flex; align-items: center; gap: 7px; height: 26px; padding: 0 10px; border-radius: var(--radius-sm); font: 500 12px/1 var(--font-sans); background: var(--bg-300); color: var(--ink-muted); white-space: nowrap; }
.rk-badge__dot { width: 6px; height: 6px; border-radius: var(--radius-pill); background: currentColor; }
.rk-badge--pill { height: 30px; padding: 0 12px; border-radius: var(--radius-pill); background: var(--bg-100); border: 1px solid var(--line); color: var(--ink); font-size: 13px; box-shadow: var(--shadow-sm); }
.rk-badge--pill .rk-badge__dot { background: var(--ok-dot); box-shadow: 0 0 0 3px var(--ok-soft); }
.rk-badge--ok:not(.rk-badge--pill) { background: var(--ok-soft); color: var(--ok); }
.rk-badge--warn:not(.rk-badge--pill) { background: var(--warn-soft); color: var(--warn); }
.rk-badge--danger:not(.rk-badge--pill) { background: var(--danger-soft); color: var(--danger); }
.rk-badge--info:not(.rk-badge--pill) { background: var(--accent-soft); color: var(--accent-ink); }

/* Card */
.rk-card { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); background: var(--bg-100); border: 1px solid var(--line); border-radius: var(--radius-lg); color: var(--ink); text-align: left; font: inherit; text-decoration: none; box-sizing: border-box; width: 100%; box-shadow: var(--shadow-sm); }
.rk-card--interactive { cursor: pointer; transition: transform .25s ease, box-shadow .25s ease, border-color .2s ease; }
.rk-card--interactive:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--line-strong); }
.rk-card--selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), var(--shadow-md); }
.rk-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.rk-card__ref { font: 500 12px/1.4 var(--font-sans); color: var(--accent-ink); }
.rk-card__title { font: 700 18px/1.35 var(--font-display); letter-spacing: -.015em; color: var(--ink); }
.rk-card__body { font-size: 14px; line-height: 1.6; color: var(--ink-muted); }
.rk-card__link { display: inline-flex; align-items: center; gap: 6px; margin-top: var(--space-2); font: 600 13px/1 var(--font-sans); color: var(--accent-ink); }
.rk-card__arrow { display: inline-flex; transition: transform .25s ease; }
.rk-card--interactive:hover .rk-card__arrow { transform: translateX(3px); }
.rk-card__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-muted); }

/* Steps */
.rk-steps { display: flex; align-items: center; gap: var(--space-1); list-style: none; margin: 0; padding: 0; flex-wrap: wrap; }
.rk-steps__card { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 120px; min-height: 124px; box-sizing: border-box; padding: var(--space-4) var(--space-2); border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--bg-100); color: var(--ink); font: inherit; cursor: pointer; transition: transform .25s ease, border-color .2s ease, background-color .2s ease; }
.rk-steps__card:hover { transform: translateY(-2px); border-color: var(--accent); }
.rk-steps__card.is-active { border-color: var(--accent); background: var(--accent-soft); }
.rk-steps__icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--accent-soft); color: var(--accent-ink); margin-bottom: 4px; }
.rk-steps__num { font: 500 12px/1 var(--font-sans); color: var(--ink-muted); }
.rk-steps__label { font: 700 14px/1.3 var(--font-display); text-align: center; }
.rk-steps__sep { display: inline-flex; color: var(--ink-subtle); }
.rk-steps--dark .rk-steps__card { background: var(--deep-raised); border-color: var(--deep-line); color: var(--on-deep); }
.rk-steps--dark .rk-steps__card:hover, .rk-steps--dark .rk-steps__card.is-active { border-color: var(--on-deep-accent); }
.rk-steps--dark .rk-steps__icon { background: var(--deep); color: var(--on-deep-accent); }
.rk-steps--dark .rk-steps__num { color: var(--on-deep-muted); }
.rk-steps--dark .rk-steps__sep { color: var(--on-deep-muted); }

/* Callout — the dark navy panel with a blueprint grid */
.rk-callout { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-6); padding: var(--space-7); border-radius: var(--radius-xl); background-color: var(--deep); background-image: linear-gradient(var(--deep-line) 1px, transparent 1px), linear-gradient(90deg, var(--deep-line) 1px, transparent 1px); background-size: 40px 40px; background-position: -1px -1px; color: var(--on-deep); }
.rk-callout__main { flex: 1 1 360px; display: flex; flex-direction: column; gap: var(--space-5); }
.rk-callout__action .rk-btn--primary { box-shadow: var(--shadow-accent); }
.rk-callout__aside { flex: 0 1 auto; }
@media (max-width: 640px) { .rk-callout { padding: var(--space-5); } }

/* Stat */
.rk-stat { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5); background: var(--bg-100); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.rk-stat__head { display: flex; align-items: center; gap: var(--space-2); }
.rk-stat__label { font: 500 13px/1.3 var(--font-sans); color: var(--ink-muted); }
.rk-stat__value { font: 800 44px/1 var(--font-display); letter-spacing: -.03em; color: var(--ink); font-variant-numeric: tabular-nums; }
.rk-stat__unit { font-size: 18px; font-weight: 600; letter-spacing: 0; color: var(--ink-muted); margin-left: 4px; }
.rk-stat__bar { height: 6px; border-radius: var(--radius-pill); background: var(--bg-300); overflow: hidden; }
.rk-stat__bar span { display: block; height: 100%; border-radius: inherit; background: var(--accent); transform-origin: left; animation: rk-grow .9s cubic-bezier(.2,.7,.2,1) both; }
@keyframes rk-grow { from { transform: scaleX(0); } }
.rk-stat__delta { font: 600 13px/1.4 var(--font-sans); }
.rk-stat__delta--good { color: var(--ok); }
.rk-stat__delta--bad { color: var(--danger); }
.rk-stat__delta--flat { color: var(--ink-muted); }
.rk-stat__cap { color: var(--ink-subtle); font-weight: 400; }

/* Field */
.rk-field { display: flex; flex-direction: column; gap: 6px; min-width: 240px; }
.rk-field__label { font: 600 14px/1.4 var(--font-sans); color: var(--ink); }
.rk-field__box { position: relative; display: flex; align-items: center; }
.rk-field__control { flex: 1; box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 14px; font: 400 15px/1.4 var(--font-sans); color: var(--ink); background: var(--bg-200); border: 1px solid var(--line-strong); border-radius: var(--radius-md); transition: border-color .18s ease, box-shadow .18s ease; resize: vertical; }
.rk-field__control::placeholder { color: var(--ink-subtle); }
.rk-field__control:hover { border-color: var(--ink-muted); }
.rk-field__control:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px var(--accent-soft); }
.rk-field__suffix { position: absolute; right: 14px; font-size: 13px; color: var(--ink-muted); pointer-events: none; }
.rk-field__msg { display: flex; align-items: center; gap: 6px; font-size: 13px; line-height: 1.4; color: var(--ink-muted); }
.rk-field--error .rk-field__control { border-color: var(--danger); }
.rk-field__msg--error { color: var(--danger); font-weight: 500; }

/* Switch */
.rk-switch { display: inline-flex; align-items: center; gap: var(--space-3); cursor: pointer; font-size: 14px; color: var(--ink); }
.rk-switch--disabled { opacity: .45; cursor: not-allowed; }
.rk-switch__track { position: relative; flex: none; width: 44px; height: 24px; padding: 0; border-radius: var(--radius-pill); border: 1px solid var(--line-strong); background: var(--bg-300); cursor: inherit; transition: background-color .2s ease, border-color .2s ease; }
.rk-switch__thumb { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: var(--radius-pill); background: var(--bg-100); box-shadow: 0 1px 3px #0f172a40; transition: transform .25s cubic-bezier(.2,.7,.2,1); }
.rk-switch__track[aria-checked="true"] { background: var(--accent); border-color: var(--accent); }
.rk-switch__track[aria-checked="true"] .rk-switch__thumb { transform: translateX(20px); background: var(--on-accent); }

/* Tabs — segmented */
.rk-tabs__list { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-lg); background: var(--bg-300); }
.rk-tabs__tab { display: inline-flex; align-items: center; gap: var(--space-2); height: 36px; padding: 0 var(--space-4); border: 0; border-radius: var(--radius-md); background: transparent; color: var(--ink-muted); font: 600 14px/1 var(--font-sans); cursor: pointer; transition: background-color .18s ease, color .18s ease, box-shadow .18s ease; }
.rk-tabs__tab:hover { color: var(--ink); }
.rk-tabs__tab.is-active { background: var(--bg-100); color: var(--ink); box-shadow: var(--shadow-sm); }
.rk-tabs__count { font: 600 11px/18px var(--font-sans); min-width: 18px; padding: 0 5px; border-radius: var(--radius-pill); background: var(--bg-100); color: var(--ink-muted); }
.rk-tabs__tab.is-active .rk-tabs__count { background: var(--accent-soft); color: var(--accent-ink); }
.rk-tabs__panel { padding-top: var(--space-4); font-size: 15px; color: var(--ink-muted); }

/* Alert */
.rk-alert { display: flex; gap: var(--space-3); align-items: flex-start; padding: var(--space-4) var(--space-5); border-radius: var(--radius-lg); background: var(--bg-100); border: 1px solid var(--line); box-shadow: var(--shadow-sm); }
.rk-alert__icon { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-md); background: var(--accent-soft); color: var(--accent-ink); }
.rk-alert--ok .rk-alert__icon { background: var(--ok-soft); color: var(--ok); }
.rk-alert--warn .rk-alert__icon { background: var(--warn-soft); color: var(--warn); }
.rk-alert--danger { background: var(--danger-soft); border-color: var(--danger-soft); }
.rk-alert--danger .rk-alert__icon { background: var(--bg-100); color: var(--danger); }
.rk-alert__text { flex: 1; display: flex; flex-direction: column; gap: 2px; padding-top: 4px; }
.rk-alert__title { font: 700 15px/1.4 var(--font-display); color: var(--ink); }
.rk-alert__body { font-size: 14px; line-height: 1.5; color: var(--ink-muted); }
.rk-alert__action { align-self: center; }
.rk-alert__close { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--ink-muted); cursor: pointer; }
.rk-alert__close:hover { background: var(--bg-300); color: var(--ink); }

@media (prefers-reduced-motion: reduce) {
  .rk-btn, .rk-btn__arrow, .rk-card--interactive, .rk-card__arrow, .rk-steps__card, .rk-switch__thumb { transition: none; }
  .rk-stat__bar span { animation: none; }
}
```

### Vzorové značky komponent

```html
<!-- Nadpis sekce -->
<header class="rk-sh">
  <div class="rk-eyebrow">S čím vám pomohu</div>
  <h2 class="rk-sh__title">Praktické služby BOZP a PO pro skutečný provoz</h2>
  <p class="rk-sh__lead">Vyberte si oblast, kterou potřebujete řešit.</p>
</header>

<!-- Tlačítka -->
<a class="rk-btn rk-btn--primary" href="#kontakt"><span>Poptat nezávaznou konzultaci</span><span class="rk-btn__arrow">→</span></a>
<a class="rk-btn rk-btn--secondary" href="#sluzby"><span>Prohlédnout služby</span></a>
<a class="rk-btn rk-btn--dark" href="#"><span>Zjistit moje povinnosti</span><span class="rk-btn__arrow">→</span></a>

<!-- Štítek nad hero -->
<span class="rk-badge rk-badge--pill"><span class="rk-badge__dot"></span>Externí specialista BOZP a PO pro firmy v ČR</span>

<!-- Stavový štítek -->
<span class="rk-badge rk-badge--warn"><span class="rk-badge__dot"></span>Do 30 dnů</span>

<!-- Karta (mřížka: <div class="rk-grid">…</div>) -->
<a class="rk-card rk-card--interactive" href="#">
  <div class="rk-card__top"><span class="rk-tile"><!-- SVG ikona 18 px --></span></div>
  <div class="rk-card__ref">§ 101 a § 102 zákoníku práce</div>
  <div class="rk-card__title">Prevence rizik</div>
  <div class="rk-card__body">Vyhledávat nebezpečí, hodnotit rizika a přijímat opatření.</div>
  <div class="rk-card__link"><span>Zjistit více</span><span class="rk-card__arrow">→</span></div>
</a>

<!-- Tmavý panel výzvy -->
<section class="rk-callout">
  <div class="rk-callout__main">
    <header class="rk-sh rk-sh--dark">
      <div class="rk-eyebrow">Vstupní bod</div>
      <h2 class="rk-sh__title rk-sh__title--sm">Nevíte, v jakém stavu máte BOZP a požární ochranu?</h2>
      <p class="rk-sh__lead">Začněme vstupním auditem.</p>
    </header>
    <div class="rk-callout__action"><a class="rk-btn rk-btn--primary" href="#"><span>Chci vstupní audit</span><span class="rk-btn__arrow">→</span></a></div>
  </div>
</section>

<!-- KPI -->
<div class="rk-stat">
  <div class="rk-stat__head"><span class="rk-stat__label">Proškoleno</span></div>
  <div class="rk-stat__value">94<span class="rk-stat__unit">%</span></div>
  <div class="rk-stat__bar"><span style="width:94%"></span></div>
  <div class="rk-stat__delta rk-stat__delta--good">↑ 6 p. b. <span class="rk-stat__cap">za kvartál</span></div>
</div>
```

Kompletní systém s živými ukázkami a React komponentami (`window.Rakos`) je v artifactu **Rákoš BOZP** (typ Design System).
