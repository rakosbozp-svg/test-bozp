// Šířky znaků pro zalamování textu ve výkresech bez DOM (evakuační plán): max(Roboto – písmo PDF, Liberation Sans ≈ Arial),
// v tisícinách em. Text zalomený podle těchto šířek se vejde do rámečku v PDF i v náhledu prohlížeče. Vygenerováno z písem
// vendor/fonts/Roboto-*.woff a Liberation Sans (metrika Arial); neznámý znak se počítá jako 0,6 em (tučně 0,65 em).
const ZNAKY = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽäöüÄÖÜß„“”‚‘’–—…×°²³·€§±≤≥→←";
const SIRKY = { r: [278,278,355,616,562,889,667,191,342,348,431,584,278,333,278,412,562,562,562,562,562,562,562,562,562,562,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,552,667,556,873,722,778,667,778,722,667,611,722,667,944,667,667,611,278,410,278,469,556,333,556,561,523,564,556,347,561,556,243,239,507,243,876,556,570,561,568,338,516,327,556,500,751,500,500,500,338,260,338,680,556,523,637,556,556,278,556,570,338,516,375,556,556,500,500,667,722,722,667,667,278,722,778,722,667,611,722,722,667,611,556,570,556,667,778,722,611,344,354,357,222,222,222,656,1000,1000,584,400,367,367,333,562,613,549,549,549,1000,1000], b: [278,333,474,596,574,889,722,238,351,353,453,584,278,388,291,374,574,574,574,574,574,574,574,574,574,574,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,292,559,722,611,876,722,778,667,778,722,667,619,722,667,944,667,667,611,333,422,333,584,556,333,556,611,556,611,556,358,611,611,278,278,556,278,889,611,611,611,611,389,556,338,611,556,778,556,556,509,389,280,389,648,556,556,719,556,556,278,611,611,389,556,479,611,611,556,509,722,722,722,667,667,292,722,778,722,667,619,722,722,667,611,556,611,611,722,778,722,631,500,500,500,278,278,278,632,1000,1000,584,400,373,373,333,574,628,549,549,549,1000,1000] };
const MAPA = { r: new Map(), b: new Map() };
[...ZNAKY].forEach((ch, i) => { MAPA.r.set(ch, SIRKY.r[i]); MAPA.b.set(ch, SIRKY.b[i]); });
export const KAPITALKY = 0.711;   // výška velkých písmen Roboto (písmo PDF) jako podíl velikosti písma

// Šířka textu v mm při velikosti písma `mm` (velikost = em).
export function sirkaTextu(text, mm, tucne = false) {
  const m = tucne ? MAPA.b : MAPA.r, vychozi = tucne ? 650 : 600;
  let s = 0;
  for (const ch of String(text ?? '')) s += m.get(ch) ?? vychozi;
  return (s / 1000) * mm;
}

// Zalomí text na řádky o šířce max (mm); příliš dlouhé slovo se rozdělí po znacích. Prázdný řádek odstavce zůstane.
export function zalomText(text, max, mm, tucne = false) {
  const out = [];
  for (const odst of String(text ?? '').split('\n')) {
    let cur = '';
    for (const slovo of odst.split(/\s+/).filter(Boolean)) {
      const zkus = cur ? `${cur} ${slovo}` : slovo;
      if (sirkaTextu(zkus, mm, tucne) <= max) { cur = zkus; continue; }
      if (cur) out.push(cur);
      cur = '';
      let cast = '';
      for (const ch of slovo) { if (cast && sirkaTextu(cast + ch, mm, tucne) > max) { out.push(cast); cast = ''; } cast += ch; }
      cur = cast;
    }
    out.push(cur);
  }
  return out;
}

// Text zkrácený výpustkou na šířku max (mm).
export function zkratText(text, max, mm, tucne = false) {
  let t = String(text ?? '');
  if (sirkaTextu(t, mm, tucne) <= max) return t;
  while (t && sirkaTextu(`${t}…`, mm, tucne) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}
