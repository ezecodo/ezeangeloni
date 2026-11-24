#!/bin/zsh
# Rebuilds public/obras/salamat-lampara/ (Salamat Clot's opening scene as a piece of the Cronovisor) from the salamat
# repo's main: its Escena.astro alone, then retakes the cover (the scene's last frame).
# Usage: tools/salamat-lampara/build.sh   (needs ~/Desktop/dev/salamat with node_modules, and Google Chrome)
set -e
HERE=${0:A:h}; EZE=${HERE:h:h}; SA=~/Desktop/dev/salamat; WT=$(mktemp -d)/wt
git -C $SA worktree add --detach $WT HEAD >/dev/null
trap "git -C $SA worktree remove --force $WT" EXIT
rm -rf $WT/public $WT/src/pages && mkdir $WT/src/pages && cp $HERE/scene-page.astro $WT/src/pages/index.astro
echo "import { defineConfig } from 'astro/config'; export default defineConfig({ base: '/obras/salamat-lampara', build: { assets: '_a' } });" > $WT/astro.config.mjs
ln -s $SA/node_modules $WT/node_modules
(cd $WT && npx astro build >/dev/null)
rm -rf $EZE/public/obras/salamat-lampara && mkdir -p $EZE/public/obras/salamat-lampara && cp -R $WT/dist/. $EZE/public/obras/salamat-lampara/
# the cover: the scene's last frame at the plate's size (1000×525: the photo's 1772×930, uncropped)
(cd $EZE/public && python3 -m http.server 4399 >/dev/null 2>&1 & echo $! > $WT/srv.pid); sleep 1
node $HERE/cover.mjs http://127.0.0.1:4399/obras/salamat-lampara/index.html $WT/cover.png
kill $(cat $WT/srv.pid)
cwebp -quiet -q 84 $WT/cover.png -o $EZE/public/obras/salamat-lampara/cover.webp
echo "ok: public/obras/salamat-lampara"
