import test from 'node:test';
import assert from 'node:assert/strict';
import { dekodujMtext, dekodujText, dekodujXmlEntity } from '../js/kresleni/import/mtext.js';

test('MTEXT: zalomení řádků, nezlomitelná mezera, escapované znaky', () => {
  assert.equal(dekodujMtext('Strojní dílny\\PSklad'), 'Strojní dílny\nSklad');
  assert.equal(dekodujMtext('A\\~B'), 'A\u00a0B');
  assert.equal(dekodujMtext('cesta C:\\\\tmp \\{x\\}'), 'cesta C:\\tmp {x}');
});

test('MTEXT: formátovací skupiny a parametry se odstraní, text zůstane', () => {
  assert.equal(dekodujMtext('{\\fArial|b0|i0|c238|p34;Požární úsek}'), 'Požární úsek');
  assert.equal(dekodujMtext('\\H2.5x;Velký\\H1x; malý'), 'Velký malý');
  assert.equal(dekodujMtext('\\C1;červený \\c255;text'), 'červený text');
  assert.equal(dekodujMtext('\\Lpodtržený\\l a \\Opřeškrtnutý\\o'), 'podtržený a přeškrtnutý');
  assert.equal(dekodujMtext('\\pxqc;Střed'), 'Střed');
  assert.equal(dekodujMtext('\\W0.8;\\Q15;\\T2;úzký'), 'úzký');
});

test('MTEXT: zlomky, Unicode \\U+XXXX a AutoCAD kódy', () => {
  assert.equal(dekodujMtext('\\S1/2; palce'), '1/2 palce');
  assert.equal(dekodujMtext('\\S+0.1^-0.1;'), '+0.1/-0.1');
  assert.equal(dekodujMtext('P\\U+0159\\U+00ED\\U+010Dka'), 'Příčka');
  assert.equal(dekodujMtext('%%c25 %%p0,5 45%%d 100%%%'), 'Ø25 ±0,5 45° 100%');
  assert.equal(dekodujMtext('%%u%%o%%kvše%%u'), 'vše');
  assert.equal(dekodujMtext('A%%065B'), 'AAB');
});

test('XML entity (pojmenované i číselné) a kombinace s MTEXT', () => {
  assert.equal(dekodujXmlEntity('A &amp; B &lt;5&gt; &quot;x&quot; &#269;&#x161;'), 'A & B <5> "x" čš');
  assert.equal(dekodujMtext('{\\fArial;Dílna &amp; sklad}\\PI. NP'), 'Dílna & sklad\nI. NP');
  assert.equal(dekodujXmlEntity('&neznama; &#99999999;'), '&neznama; &#99999999;');
});

test('prostý TEXT: AutoCAD kódy a \\U+', () => {
  assert.equal(dekodujText('Ro%%c100  '), 'RoØ100');
  assert.equal(dekodujText('\\U+010Cerpadlo'), 'Čerpadlo');
});

test('MTEXT: prázdný a podivný vstup nespadne', () => {
  assert.equal(dekodujMtext(''), ''); assert.equal(dekodujMtext(undefined), ''); assert.equal(dekodujMtext('\\'), ''); assert.equal(dekodujMtext('{\\f'), '');
  assert.equal(dekodujMtext('řádek1\\P\\P\\P\\Přádek2'), 'řádek1\n\nřádek2');
});
