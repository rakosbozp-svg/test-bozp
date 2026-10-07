// Sestaví celou aplikaci do JEDNOHO souboru dist/pozarni-planovac.html (bez serveru, otevře se dvojklikem).
// Vloží JS (esbuild), CSS, katalog značek s obrázky, referenční projekt Litice a pdf.js worker. Použití: npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const koren = join(dirname(fileURLToPath(import.meta.url)), '..');
const cti = (p) => readFileSync(join(koren, p));
const txt = (p) => cti(p).toString('utf8');
const zabezpecit = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');   // bezpečné vložení do <script>

const js = await build({ entryPoints: [join(koren, 'js/app.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022', legalComments: 'none', logLevel: 'error', external: ['node:fs/promises'], define: { 'import.meta.url': '"about:blank"' } });
const kod = js.outputFiles[0].text;

const kat = JSON.parse(txt('znacky/katalog.json')).znacky.map((z) => ({ id: z.id, nazev: z.nazev, zdroj: z.zdroj, png: `data:image/png;base64,${cti(z.png).toString('base64')}`, overeno: z.overeno }));
const worker = cti('vendor/pdfjs/pdf.worker.min.mjs').toString('base64');
const litice = txt('data/litice.projekt.json');
const verze = new Date().toISOString().slice(0, 16).replace('T', ' ');

let html = txt('index.html');
html = html.replace(/<link rel="stylesheet" href="css\/rakos.css">\s*<link rel="stylesheet" href="css\/app.css">/, () => `<style>\n${txt('css/rakos.css')}\n${txt('css/app.css')}\n</style>`);
html = html.replace(/<script type="module" src="js\/app.js"><\/script>/, () =>
  `<script>window.__KATALOG__=${zabezpecit(JSON.stringify(kat))};window.__LITICE__=${zabezpecit(JSON.stringify(litice))};window.__SESTAVENO__=${JSON.stringify(verze)};window.__FONTY__=${JSON.stringify({ regular: cti('vendor/fonts/Roboto-Regular.woff').toString('base64'), bold: cti('vendor/fonts/Roboto-Bold.woff').toString('base64') })};` +
  `try{var b=atob("${worker}"),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);window.__PDFJS_WORKER_URL__=URL.createObjectURL(new Blob([u],{type:"text/javascript"}));}catch(e){}</script>\n` +
  `<script>\n${zabezpecit(kod)}\n</script>`);
if (!html.includes('window.__KATALOG__')) throw new Error('Sestavení selhalo: nepodařilo se vložit skript');
// Varianta pro zveřejnění jako Artifact: bez <html>/<head>/<body> (obálku doplní platforma), jen <title>, písma, styl, obsah a skripty.
const telo = /<body>([\s\S]*)<\/body>/.exec(html)[1];
const hlava = (/<title>[\s\S]*?<\/title>/.exec(html) || [''])[0] + '\n' + (html.match(/<link[^>]+fonts[^>]*>/g) || []).join('\n') + '\n' + (/<style>[\s\S]*?<\/style>/.exec(html) || [''])[0];
mkdirSync(join(koren, 'dist'), { recursive: true });
writeFileSync(join(koren, 'dist/pozarni-planovac.artifact.html'), `${hlava}\n${telo}`);
writeFileSync(join(koren, 'dist/pozarni-planovac.html'), html);
console.log(`dist/pozarni-planovac.html: ${(html.length / 1048576).toFixed(2)} MB (JS ${(kod.length / 1024).toFixed(0)} kB, katalog ${kat.length} značek)`);
