#!/bin/bash
# Bot Crossing — dvojklikem spustíš dashboard (macOS). Okno terminálu nech otevřené; zavřením se dashboard vypne.
cd "$(dirname "$0")" || exit 1

# Finder spouští "holý" shell: přidej běžná umístění Node.js (Homebrew, nvm).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

pause() { read -n1 -r -p "Stiskni libovolnou klávesu…"; echo; }

if ! command -v node >/dev/null 2>&1; then
  echo "Chybí Node.js. Nainstaluj verzi LTS z https://nodejs.org a spusť znovu."
  pause; exit 1
fi

# Instalace při prvním spuštění a po aktualizaci (když se změní package-lock.json).
if ! node -e "const f=require('fs');process.exit(f.statSync('package-lock.json').mtimeMs>f.statSync('node_modules/.package-lock.json').mtimeMs?1:0)" 2>/dev/null; then
  echo "Instaluji závislosti (jen poprvé nebo po aktualizaci, chvíli to trvá)…"
  npm install --no-fund --no-audit || { echo "Instalace selhala."; pause; exit 1; }
fi

[ -f .data/setup.json ] || npm run --silent setup

npm start
