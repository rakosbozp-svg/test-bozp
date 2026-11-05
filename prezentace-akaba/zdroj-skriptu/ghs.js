const { chromium } = require('playwright');
const out = process.argv[2];
const D = '<polygon points="100,8 192,100 100,192 8,100" fill="#fff" stroke="#E3000F" stroke-width="13" stroke-linejoin="miter"/>';
const bone = (rot) => `<g transform="rotate(${rot} 100 130)"><rect x="66" y="125.5" width="68" height="9" rx="4.5"/><circle cx="65" cy="125" r="6"/><circle cx="65" cy="135" r="6"/><circle cx="135" cy="125" r="6"/><circle cx="135" cy="135" r="6"/></g>`;
const icons = {
  ghs03: `${D}<g fill="#000">
    <path d="M100 38 C112 56 128 70 124 92 C132 86 134 76 132 68 C146 86 142 110 122 116 L78 116 C58 110 54 86 68 68 C66 78 70 88 78 92 C72 70 90 58 100 38 Z"/>
    </g>
    <circle cx="100" cy="134" r="17" fill="none" stroke="#000" stroke-width="9"/>
    <rect x="62" y="156" width="76" height="7" fill="#000"/>`,
  ghs04: `${D}<g fill="#000" transform="rotate(-18 100 110)">
    <rect x="48" y="92" width="88" height="38" rx="19"/>
    <rect x="134" y="102" width="14" height="18" rx="2"/>
    <rect x="148" y="97" width="8" height="28" rx="2"/></g>`,
  ghs06: `${D}<g fill="#000">${bone(28)}${bone(-28)}
    <circle cx="100" cy="78" r="26"/><rect x="86" y="92" width="28" height="22" rx="5"/></g>
    <g fill="#fff"><ellipse cx="90.5" cy="79" rx="7.5" ry="8.5"/><ellipse cx="109.5" cy="79" rx="7.5" ry="8.5"/>
    <polygon points="100,89 96,97 104,97"/><rect x="92" y="104" width="2.5" height="10"/><rect x="98.75" y="104" width="2.5" height="10"/><rect x="105.5" y="104" width="2.5" height="10"/></g>`,
  ghs09: `${D}<g stroke="#000" stroke-linecap="round" fill="none">
    <line x1="72" y1="150" x2="72" y2="70" stroke-width="7"/>
    <line x1="72" y1="104" x2="52" y2="80" stroke-width="5"/><line x1="72" y1="92" x2="92" y2="66" stroke-width="5"/>
    <line x1="72" y1="120" x2="90" y2="100" stroke-width="5"/><line x1="58" y1="88" x2="48" y2="90" stroke-width="4"/>
    <line x1="84" y1="77" x2="96" y2="80" stroke-width="4"/><line x1="44" y1="152" x2="156" y2="152" stroke-width="6"/></g>
    <g fill="#000"><ellipse cx="124" cy="138" rx="24" ry="10"/><polygon points="100,138 86,128 86,148"/></g>
    <g stroke="#fff" stroke-width="2.5"><line x1="136" y1="133" x2="142" y2="139"/><line x1="142" y1="133" x2="136" y2="139"/></g>`,
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 3 });
  for (const [k, v] of Object.entries(icons)) {
    await p.setContent(`<html><body style="margin:0;background:transparent"><svg id="s" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${v}</svg></body></html>`);
    await (await p.$('#s')).screenshot({ path: `${out}/${k}.png`, omitBackground: true });
  }
  await b.close();
})();
