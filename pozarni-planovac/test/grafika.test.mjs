import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { zkontrolujUplnost } from '../js/uplnost.js';

const upoz = (p) => zkontrolujUplnost(p).filter((n) => n.kod.startsWith('GRAF_')).map((n) => n.kod);
const zn = (id, znackaId) => ({ id, druh: 'znacka', x: 1, y: 1, znackaId, velikost: 8, vrstva: 'znacky' });

test('situace: chybějící vodní zdroj, nástupní plocha, uzávěry a místo evakuace se hlásí jako upozornění', () => {
  const p = M.novyProjekt(), sit = p.listy.find((l) => l.typ === 'situace');
  assert.deepEqual(upoz(p), [], 'prázdný výkres neřeší (hlásí obecná kontrola)');
  sit.vykres.prvky.push({ id: 's', druh: 'stena', body: [[0, 0], [10, 0]], tloustkaM: 0.3, barva: '#000', vrstva: 'zaklad' });
  assert.deepEqual(upoz(p).sort(), ['GRAF_SIT_EVAKUACE', 'GRAF_SIT_NASTUP', 'GRAF_SIT_UZAVERY', 'GRAF_SIT_VODA']);
  sit.vykres.prvky.push(zn('a', 'DZP-001'), zn('b', 'DZP-055'), zn('c', 'DZP-042'),
    { id: 'pl', druh: 'plocha', body: [[0, 0], [5, 0], [5, 5]], vypln: '#f2d200', kryti: 0.6, barva: '#000', tloustka: 0.3, vrstva: 'komunikace' });
  assert.deepEqual(upoz(p), []);
  assert.ok(zkontrolujUplnost(p).filter((n) => n.kod.startsWith('GRAF_')).every((n) => n.hladina === 'upozorneni'));
});

test('soulad s kartou: FVE, plyn, EPS, hydrant a nebezpečí uvedené v kartě musí být ve výkresech', () => {
  const p = M.novyProjekt(), k = p.listy.find((l) => l.typ === 'karta').karta, sit = p.listy.find((l) => l.typ === 'situace');
  sit.vykres.prvky.push(zn('c', 'DZP-042'));
  k.fve.pritomna = true; k.media.hlavniUzaverPlynu = 'u brány'; k.pbz.eps = 'vrátnice'; k.media.hlavniVypinacEl = 'NE';
  k.vodniZdroje.push({ id: 'v', typ: 'hydrant', popis: 'u brány' }); k.nebezpeci.push({ id: 'n', popis: 'benzin', hasivo: 'pěna' });
  const u = upoz(p);
  for (const kod of ['GRAF_KARTA_FVE', 'GRAF_KARTA_PLYN', 'GRAF_KARTA_EPS', 'GRAF_KARTA_HYDRANT', 'GRAF_KARTA_NEBEZPECI']) assert.ok(u.includes(kod), kod);
  assert.ok(!u.includes('GRAF_KARTA_VYPINAC'), '„NE“ se nehlásí');
  sit.vykres.prvky.push(zn('1', 'DZP-104'), zn('2', 'DZP-005'), zn('3', 'DZP-054'), zn('4', 'DZP-004'), zn('5', 'DZP-053'));
  assert.ok(!upoz(p).some((x) => x.startsWith('GRAF_KARTA')));
});

test('evakuační plán se grafikou DZP nekontroluje', () => {
  const p = M.novyProjekt({ typ: 'evakuacni_plan' });
  p.listy[1].vykres.prvky.push({ id: 's', druh: 'stena', body: [[0, 0], [1, 0]], tloustkaM: 0.3, barva: '#000', vrstva: 'zaklad' });
  assert.deepEqual(upoz(p), []);
});
