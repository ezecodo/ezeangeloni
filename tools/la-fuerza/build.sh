#!/bin/zsh
# Rebuilds public/obras/la-fuerza/ (La Fuerza Café's opening, the pink shutter, as a piece of the Cronovisor) from the
# fuerza repo's main: its home page, with the shutter always shown (the site skips it when you come from the same
# origin, and the Cronovisor's iframe is), its public/ assets moved under the base, links sent to the real site, and
# the cover (the shutter closed, with the mural, waiting for the star).
# Usage: tools/la-fuerza/build.sh   (needs ~/Desktop/dev/fuerza with node_modules, Google Chrome, and Puppeteer in ~/Desktop/dev/cv)
set -e
HERE=${0:A:h}; EZE=${HERE:h:h}; FU=~/Desktop/dev/fuerza; WT=$(mktemp -d)/wt; OUT=$EZE/public/obras/la-fuerza; BASE=/obras/la-fuerza
git -C $FU worktree add --detach $WT HEAD >/dev/null
trap "git -C $FU worktree remove --force $WT" EXIT
perl -0pi -e 's/\n\s*try \{\s*if \(document\.referrer[^\n]*\n\s*\} catch \(e\) \{\}//' $WT/src/components/Intro.astro
grep -q 'document.referrer' $WT/src/components/Intro.astro && { echo "the shutter's referrer check moved: patch build.sh"; exit 1; }
find $WT/src/pages -type f ! -name index.astro -delete
echo "import { defineConfig } from 'astro/config'; export default defineConfig({ site: 'https://lafuerzabcn.pages.dev', base: '$BASE', build: { assets: '_a' } });" > $WT/astro.config.mjs
ln -s $FU/node_modules $WT/node_modules
(cd $WT && npx astro build >/dev/null)
rm -rf $OUT && mkdir -p $OUT && cp -R $WT/dist/. $OUT/
rm -f $OUT/_headers
# the site's own files are written as /svg/…, /img/…, /galeria/…: under the base here
find $OUT -name '*.html' -o -name '*.css' -o -name '*.js' | while read f; do perl -pi -e 's#(["'"'"'(\s,])/(svg|img|galeria)/#$1'$BASE'/$2/#g' "$f"; done
perl -0pi -e 'BEGIN{ local $/; open F, "<", "'$HERE'/inject.html"; $i = <F>; close F } s#</body>#$i</body>#' $OUT/index.html
(cd $EZE/public && python3 -m http.server 4399 >/dev/null 2>&1 & echo $! > $WT/srv.pid); sleep 1
node $EZE/tools/salamat-lampara/cover.mjs http://127.0.0.1:4399$BASE/index.html $WT/cover.png 1280 800 6000
kill $(cat $WT/srv.pid)
cwebp -quiet -q 84 $WT/cover.png -o $OUT/cover.webp
echo "ok: public/obras/la-fuerza"
