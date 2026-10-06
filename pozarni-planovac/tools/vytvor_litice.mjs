// Vytvoří data/litice.projekt.json – jen z informací, které uživatel potvrdil. Nic dalšího se nedomýšlí.
import { writeFileSync } from 'node:fs';
import * as M from '../js/model.js';

const p = M.novyProjekt({ nazev: 'DZP Litice' });
const k = p.listy[0].karta;
Object.assign(k.fve, {
  pritomna: true, pocetPanelu: 488, vykonKWp: 460, baterie: false,
  popis: 'FVE na hale PREFA 1; výkonové optimizéry 2:1; střídače na obvodové stěně; STOP FVE před vstupem do rozvodny NN. DC část může být zásahově relevantní i po odpojení.',
});
p.poznamkyKOvereni = [
  { tema: 'Rozsah', text: 'Navazuje na schválenou DZP FVE z roku 2025 (podklad zatím nedodán).', stav: 'uzivatel_potvrdil' },
  { tema: 'Rozsah', text: 'VN zařízení, hořlavé kapaliny a výdejní místo olejů a nafty nejsou samostatným důvodem pro DZP; lze zakreslit, má-li zásahový význam.', stav: 'uzivatel_potvrdil' },
  { tema: 'Rozsah', text: 'PB klece a sklad technických plynů neposuzovat automaticky jako samostatný předmět DZP; vždy posoudit zásahový význam.', stav: 'uzivatel_potvrdil' },
  { tema: 'Poloha', text: 'Sklad PB Primagas u budovy 2 na straně do areálu; dvě klece vedle sebe, každá cca 2 × 1 m.', stav: 'uzivatel_potvrdil_priblizne' },
  { tema: 'Poloha', text: 'Sklad technických plynů za strojními dílnami, cca 5 m od pravého horního rohu plánku, v úrovni přístřešku kameniva.', stav: 'uzivatel_potvrdil_priblizne' },
  { tema: 'Poloha', text: 'Výdejní místo separačních olejů a nafty mezi objekty 6 a 12, přibližně uprostřed, cca 6 × 4 m.', stav: 'uzivatel_potvrdil_priblizne' },
  { tema: 'Chybí', text: 'Plánek areálu, adresa, GPS, kontakty, příjezdy, hydranty a zdroje vody, uzávěry a vypínače – dodá uživatel.', stav: 'chybi' },
];
writeFileSync(new URL('../data/litice.projekt.json', import.meta.url), M.serializuj(p));
