#!/bin/bash
# Regenerates the Play Store screenshots + feature graphic from src/*.html
# using headless Google Chrome. The pages must be served over http (the
# screenshots load the real app pages), e.g. by the local Apache:
#   BASE=http://localhost/mayank/MK/kidsQuiz ./make-assets.sh
set -e
cd "$(dirname "$0")"
BASE="${BASE:-http://localhost/mayank/MK/kidsQuiz}"
URL="$BASE/PlayStoreThings/store-listing/src"
CHROME="${CHROME:-google-chrome}"
# The Firebase database is blocked so the screenshots never write visits or
# players into the real app data (pages render fine without it).
shot() { "$CHROME" --headless=old --no-sandbox --disable-gpu --hide-scrollbars --host-resolver-rules="MAP *.firebasedatabase.app 127.0.0.1, MAP *.firebaseio.com 127.0.0.1" "$@" >/dev/null 2>&1; }
# Old headless Chrome loses ~100px of the window height: render taller, then crop.
crop() { python3 -c "import sys; from PIL import Image; i=Image.open(sys.argv[1]).convert('RGB'); i.crop((0,0,int(sys.argv[2]),int(sys.argv[3]))).save(sys.argv[1])" "$@"; }

names=(learn-and-play learning-path games badges owl-shop question-of-the-day olympiad weekly-report)
for n in 1 2 3 4 5 6 7 8; do
  out="screenshots/0${n}-${names[$((n-1))]}.png"
  shot --window-size=540,1100 --force-device-scale-factor=2 --virtual-time-budget=9000 --screenshot="$PWD/$out" "$URL/shot.html?n=$n"
  crop "$out" 1080 1920
  echo "$out"
done
shot --window-size=1024,640 --force-device-scale-factor=1 --virtual-time-budget=6000 --screenshot="$PWD/feature-graphic.png" "$URL/feature.html"
crop feature-graphic.png 1024 500   # also removes transparency (Play wants none)
echo feature-graphic.png
