# SAFETY RUN

Endless runner v prohlížeči: čivava v reflexní vestě a přilbě běží areálem výroby betonových prefabrikátů.

## Spuštění

Nic se neinstaluje ani nebuilduje. Stačí otevřít `index.html` v prohlížeči, nebo spustit lokální server:

```bash
python3 -m http.server 8000
# pak otevři http://localhost:8000
```

Na mobilu ve stejné Wi-Fi: `http://<IP-počítače>:8000`.

## Ovládání

| Akce | PC | Mobil |
|---|---|---|
| Pruh vlevo / vpravo | ← → nebo A D | swipe vlevo / vpravo |
| Skok | ↑, W nebo mezerník | swipe nahoru |
| Skrčení (ve vzduchu = rychlý dopad) | ↓ nebo S | swipe dolů |
| Pauza | Esc nebo P | tlačítko II |
| Restart po konci | Enter nebo mezerník | tlačítko ZNOVU |

## Postavy a prostředí

- Postavy: čivava, kotě, člověk (pracovník), šnek – všechny v přilbě a reflexní vestě.
- Prostředí: výroba prefabrikátů, kancelář, stavba, mlékárna – každé má vlastní překážky, budovy a dekorace.
- Volba se pamatuje v prohlížeči.

## Žebříček

- V aplikaci otevřené přes claude.ai se výsledky zapisují do sdílené databáze artefaktu (kolekce `hraci`, jeden dokument na hráče).
- Hráč dne, týdne a měsíce, rekordy (skóre, trať, přilby, počet her) a síň slávy minulých období.
- Zapisovat může jen přihlášený hráč s přístupem k zápisu (vlastník a členové organizace); ostatní žebříček jen vidí.

## Hra

- 3 pruhy, automatický běh, rychlost roste se vzdáleností.
- Překážky: kužely a palety (přeskoč), výkop (přeskoč), betonové bloky a protijedoucí VZV (uhni), nízké potrubí (skrč se).
- Sbírej žluté přilby. Skóre = uběhnuté metry (s brýlemi dvojnásobně).
- Power-upy (10 s): **vesta** = štít, **bezpečnostní obuv** = vyšší skok, **ochranné brýle** = skóre ×2.
- Rekord se ukládá v prohlížeči (localStorage).

## Soubory

- `index.html` – menu, HUD, obrazovky pauzy a konce hry
- `style.css` – vzhled UI
- `game.js` – celá hra (Three.js, 3D scéna je poskládaná z primitiv, žádné cizí modely)
- `vendor/three.min.js` – Three.js r158 (lokálně, funguje i offline)
- `assets/chivava.png` – obrázek postavy do menu
