// Sestaví verzi pro web (Vercel, vlastní doména) do složky web/: jen aplikace – BEZ podkladů (podklady/),
// testů a referenčního projektu Litice (obsahuje poznámky o skutečném areálu). Použití: npm run build:web
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const koren = join(dirname(fileURLToPath(import.meta.url)), '..'), cil = join(koren, 'web');
rmSync(cil, { recursive: true, force: true }); mkdirSync(cil, { recursive: true });
for (const d of ['css', 'js', 'vendor', 'znacky/png', 'znacky/evakuace']) cpSync(join(koren, d), join(cil, d), { recursive: true });
cpSync(join(koren, 'znacky/katalog.json'), join(cil, 'znacky/katalog.json'));
let html = readFileSync(join(koren, 'index.html'), 'utf8');
html = html.replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">\n<script>window.__WEB__ = true;</script>');
if (!html.includes('window.__WEB__')) throw new Error('index.html: chybí <head>');
writeFileSync(join(cil, 'index.html'), html);
writeFileSync(join(cil, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('web/ hotovo');
