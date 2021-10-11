mkdir dist
mkdir dist/fbl
mkdir dist/fbl/skin
cp build/firebud-lite-debug.js dist/fbl/firebug-lite-debug.js
cp license.txt dist/fbl/license.txt
cp -r skin/** dist/fbl/skin/
echo "done, check dist/"
