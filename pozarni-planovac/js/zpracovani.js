// Údaje o zpracování dokumentace (blok ZPRACOVAL na operativní kartě, v razítku výkresů a v evakuačním plánu). Bez závislostí.
// Zadání uživatele: zpracovatelem je vždy on – ve formuláři ho přepíše jen tehdy, když dokumentaci dělá někdo jiný.
// Datum zpracování se ručně nevyplňuje: je to vždy den poslední úpravy projektu (projekt.zmeneno), takže export ani pouhé
// otevření projektu ho nezmění a v exportu zůstane den, kdy byl projekt naposledy upraven.

export const VYCHOZI_ZPRACOVATEL = 'Šimon Rákoš';
export const VYCHOZI_CISLO_OSVEDCENI = 'Z-OZO-32/2026';   // doplní se jen výchozímu zpracovateli, nikdy jinému jménu

// ISO čas poslední úpravy → „20. 11. 2026“ (místní čas); neplatný nebo chybějící čas → ''.
export const datumUpravy = (zmeneno) => {
  const d = new Date(zmeneno ?? NaN);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
};
