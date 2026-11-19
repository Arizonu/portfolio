#!/bin/sh
# one command: three versions → kognitywistyka_pl.mp4, kognitywistyka_en.mp4, kognitywistyka_en_napisy_pl.mp4
set -e
LIB=${LIB:-$HOME/lemo-opuscar}   # the Lemo-Opuscar library (github.com/lemomo-ai/lemo-opuscar)
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
for l in pl en; do ffmpeg -loglevel error -y -i "$HERE/vo/$l.mp3" -ar 48000 -ac 1 "$HERE/vo/$l.wav"; done
"$LIB/.venv/bin/python" "$HERE/timeline.py"          # vo/pl.wav + vo/en.wav → line clips + timeline_<v>.json
cd "$LIB"
for v in pl en ensub; do
  node core/render/events.mjs "$HERE" --q "v=$v" --out "$HERE/events_$v.json"
  node core/render/video.mjs "$HERE" --q "v=$v" --fps 60 --out "$HERE/out/video_$v.mp4"
  "$LIB/.venv/bin/python" "$HERE/mix.py" $v
done
sh core/render/mux.sh "$HERE/out/video_pl.mp4" "$HERE/out/mix_pl.wav" "$HERE/kognitywistyka_pl.mp4" 60 1
sh core/render/mux.sh "$HERE/out/video_en.mp4" "$HERE/out/mix_en.wav" "$HERE/kognitywistyka_en.mp4" 60 1
sh core/render/mux.sh "$HERE/out/video_ensub.mp4" "$HERE/out/mix_ensub.wav" "$HERE/kognitywistyka_en_napisy_pl.mp4" 60 1
