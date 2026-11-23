#!/bin/sh
# Opakovatelný import svědectví (anglický dabing + české titulky) – spouštět vždy, když se změní
# /home/claude/voices/svedectvi_v3.json nebo /home/claude/voices3/ (hlasy, timing.json).
#   text      = mluvené anglické věty (text_en bez audio tagů v [hranatých závorkách])
#   titulky   = české titulky (titulky_cs), výchozí na webu; přepínač CZ / EN / vyp
# Pak: hlasy mono 96 kb/s + timing.json do assets/voices, texty a časy i do 3D mapy, data webu, lexikon a hledání.
set -e
cd "$(dirname "$0")/.."
python3 scripts/import-svedectvi.py "${SRC_SVEDECTVI:-/home/claude/voices/svedectvi_v3.json}"
SRC_VOICES="${SRC_VOICES:-/home/claude/voices3}" python3 scripts/build-media.py
python3 scripts/build-data.py
