# Jak udělat DZP z podkladů klienta (PBŘ) v Požárním plánovači

Postup jsem ověřil na DS Kladno – O. Pešky 1440: situace 1:500, půdorysy 1.NP a 2.NP 1:100, operativní karta.

## 1. Než začnete: co vytáhnout z podkladů

| Údaj | Kde ho v PBŘ najdete |
|---|---|
| Zastavěná plocha, počet podlaží, výška | technická zpráva, „Základní údaje o stavbě“ |
| Osoby (počet, děti, osoby s asistencí, spaní) | technická zpráva, „Obsazení objektu osobami“ |
| TOTAL STOP / hlavní vypínač | technická zpráva, kap. l) (elektro) |
| Plyn, voda, kotel | technická zpráva, kap. k) (TZB) |
| Hydranty a voda k hašení | technická zpráva, „Vnější odběrná místa“ (vzdálenost, GPS) |
| Příjezd hasičů | výkres situace (červený text „příjezd“) |
| Místnosti a jejich čísla | tabulka místností na výkresech půdorysů |

**Měřítko si vždy ověřte.** Spočítejte známou plochu nebo délku přímo z výkresu. V Kladně razítko situace uvádělo 1:100, ale zastavěná plocha 229 m² seděla až na 1:500.

**Rozpory nevyřešíte domněnkou.** Do karty napište „DOPLNIT“ nebo „OVĚŘIT“ a zeptejte se klienta. V Kladně šlo o plynový kotel a o hydrant ve 138 m oproti výkresu.

## 2. Operativní karta

1. Úvodní stránka DZP → **Nová DZP** → název projektu.
2. Vyplňte kartu podle tabulky výše. Neznámé údaje (kontakty, uzávěry médií, zpracovatel) označte „DOPLNIT“.

## 3. Situace

1. **Podklad:**
   1. Otevřete list Situace a dejte **Importovat podklad** → PDF situace z PBŘ → vektorově.
   2. Zadejte měřítko tisku z PBŘ a ověřte ho **kalibrací** podle známé délky.
2. **Budovy a ulice:**
   1. Nástrojem **Plocha** obkreslete budovy a ulice.
   2. V panelu **Vlastnosti** klikněte na **Výplň podle významu**: Řešený objekt, Okolní zástavba, Komunikace a zpevněné plochy, Zeleň.
3. **Příjezd hasičů:** nástroj **Směr příjezdu**. Klik = odkud, druhý klik = kam (hrot k objektu). Text na šipce jde přepsat, např. „příjezd jednotek HZS“.
4. **Značky:**
   - hlavní vchod DZP-105 (natočit hrotem do objektu);
   - TOTAL STOP / hlavní vypínač DZP-017;
   - podzemní hydrant DZP-004;
   - vedlejší vchody DZP-108.
5. **Popisky:** názvy ulic a objektu jako **Text** se zaškrtnutým **Tučně**.
6. **Nastavení listu** (panel Vlastnosti, když není vybraný žádný prvek): severka, měřítko, **Navrhnout měřítko podle obsahu** a **Vycentrovat obsah v rámu**. Hotový podklad pak můžete skrýt nebo smazat.

## 4. Půdorysy

1. Přidejte list **Půdorys** (např. „Půdorys 2.NP“). Název listu se objeví v nadpisu „– PŮDORYS 2.NP –“.
2. **Importovat podklad** → PDF půdorysu z PBŘ → vektorově, měřítko 1:100.
3. Smažte čáry, které do DZP nepatří: červené hranice požárních úseků, zelené únikové cesty a šrafy PBŘ.
4. Doplňte:
   - popisy místností (číslo + účel);
   - vstupy (DZP-105 / DZP-108);
   - TOTAL STOP;
   - osoby, např. „max. 12 dětí + 2 zaměstnanci“;
   - nebezpečí, např. kotel – červeně a s „OVĚŘIT“, pokud je v podkladech rozpor.
5. Půdorys, který se nevejde na šířku, dejte **na výšku**: Nastavení listu → orientace.

## 5. Jak to zadat Claudovi v editoru

Otevřete list → panel **Claude**. Přiložte obrázek podkladu (snímek obrazovky z PDF) a pošlete zadání. Claude kreslí přes nástroje aplikace a zná styl DZP: výplně podle významu, šipku příjezdu, tučné popisky. **Polohy z obrázku jsou jen přibližné.** Přesnou geometrii dává import PDF (kroky 3 a 4). Claude se hodí na doplnění a úpravy.

Vzor zadání pro **situaci**:

> Nakresli situaci DZP podle přiloženého výřezu situace PBŘ, měřítko 1:500, sever nahoře. Řešený objekt (parcela 4851/1) jako plochu s vyznam objekt a tučným popiskem „DĚTSKÁ SKUPINA“, okolní budovy vyznam okoli, ulice T. G. Masaryka, Tyršova a O. Pešky vyznam komunikace s tučnými názvy. Hlavní vstup z ulice O. Pešky značkou DZP-105, TOTAL STOP DZP-017 u vstupu, podzemní hydrant v Tyršově ulici DZP-004. Příjezd jednotek HZS šipkou prijezd v ulici O. Pešky od jihu k objektu s textem „příjezd jednotek HZS“. Nic jiného nedomýšlej.

Vzor zadání pro **půdorys** (po importu PDF):

> V půdorysu 2.NP smaž červené a zelené čáry z PBŘ. K číslům místností doplň účel: 2.01 schodiště, 2.02 chodba, 2.03 šatna dětí, 2.04 sociální zařízení, 2.05 WC, 2.06 chodba, 2.07 chodba + KK, 2.08 herna, 2.09 herna, 2.10 sklad + šatna zaměstnanci. Do herny 2.08 napiš tučně „DĚTSKÁ SKUPINA“ a pod to „max. 12 dětí (z toho 4 do 3 let) + 2 zaměstnanci“.

## 6. Kontrola a výstup

- **Kontrola grafické části DZP:** upozorní, co na listu chybí.
- **Export PDF:** hotové DZP k předání.
- **Stáhnout → Editovatelný projekt:** soubor `.pplan.json` k záloze nebo předání kolegovi. Kolega ho načte přes **Importovat projekt**.
