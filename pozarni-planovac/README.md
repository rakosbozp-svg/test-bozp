# Požární plánovač (DZP)

Webová aplikace pro tvorbu dokumentace zdolávání požárů (operativní karta / plán).
Stav: příprava. Zdrojový kód původního plánovače z ChatGPT zatím není k dispozici.

## Podklady (`podklady/`)
- `VZOR_OPERATIVNI_KARTA.docx` – vzor operativní karty HZS Středočeského kraje
- `Navod_k_vyplneni_operativni_karty_HZS_SCK.pdf` – pravidla vyplnění vzoru
- `Zasady_pro_zpracovani_DZP.rtf` – zásady zpracování DZP (HZS SCK)
- `Graficke_znacky_DZP.pdf` – katalog 109 značek (ČAHD, 11/2011, vektorové)

## Chybí dodat
- metodika Hanuška 1996 a „Postup při tvorbě DZP"
- PNG značky E001–E019 a F001–F006
- schválená DZP FVE 2025 a plánek areálu Litice
- ukázka požadovaného výstupu

## Plán práce
1. datový model karty podle vzoru
2. převod 109 značek do SVG (název + zdroj)
3. vyplňování karty s kontrolou úplnosti
4. editor situace a půdorysu
5. export PDF a Word
6. import DXF/PDF/SVG

Odborné údaje je nutné před vydáním DZP ověřit podle aktuální legislativy a s HZS.
