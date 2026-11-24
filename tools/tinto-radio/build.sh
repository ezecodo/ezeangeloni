#!/bin/zsh
# Rebuilds public/obras/tinto-radio/ (the Tinto & Soda radio as a piece of the Cronovisor) from the tinto_soda repo:
# its radio at the git tag `variantes-presentacion`, with the current carta and hours. Then retakes the cover.
# Usage: tools/tinto-radio/build.sh   (needs ~/Desktop/dev/tinto_soda with node_modules, and Google Chrome)
set -e
HERE=${0:A:h}; EZE=${HERE:h:h}; TS=~/Desktop/dev/tinto_soda; WT=$(mktemp -d)/wt
git -C $TS worktree add --detach $WT variantes-presentacion >/dev/null
trap "git -C $TS worktree remove --force $WT" EXIT
for f in src/data/carta.json src/data/carta.ts src/data/horarios.ts src/i18n/carta.ts src/components/ListaPlatos.astro; do cp $TS/$f $WT/$f; done
rm -rf $WT/src/pages && mkdir $WT/src/pages && cp $HERE/radio-page.astro $WT/src/pages/index.astro
echo "import { defineConfig } from 'astro/config'; export default defineConfig({ base: '/obras/tinto-radio', build: { assets: '_a' } });" > $WT/astro.config.mjs
ln -s $TS/node_modules $WT/node_modules
(cd $WT && npx astro build >/dev/null)
rm -rf $EZE/public/obras/tinto-radio && mkdir -p $EZE/public/obras/tinto-radio && cp -R $WT/dist/. $EZE/public/obras/tinto-radio/
# the cover: the same page at the plate's size (1000×720), transparent, so the swap to the live radio doesn't show
(cd $EZE/public && python3 -m http.server 4399 >/dev/null 2>&1 & echo $! > $WT/srv.pid); sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1.6 --default-background-color=00000000 --window-size=1000,720 --virtual-time-budget=6000 --screenshot=$WT/cover.png http://127.0.0.1:4399/obras/tinto-radio/index.html 2>/dev/null
kill $(cat $WT/srv.pid)
cwebp -quiet -q 86 -alpha_q 90 $WT/cover.png -o $EZE/public/obras/tinto-radio/cover.webp
echo "ok: public/obras/tinto-radio"
