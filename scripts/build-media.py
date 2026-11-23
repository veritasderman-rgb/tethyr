#!/usr/bin/env python3
"""Zkopíruje média svědectví a hymny ze zdrojových složek do assets/ (commitují se do repa).

Spuštění:  python3 scripts/build-media.py            (jen chybějící nebo novější soubory)
           python3 scripts/build-media.py --force    (znovu všechno)

Vezme vše, co ve zdrojových složkách je, a jde spouštět opakovaně (další videa se doplňují).
  hlasy:   SRC_VOICES (/home/claude/voices3)  <id>.mp3 + timing.json  →  assets/voices/  (anglický dabing, titulky česky)
  videa:   SRC_VID    (/home/claude/vid)      <id>.mp4 (1280×720, 6 s, bez zvuku)  →  assets/video/<id>.mp4
           Video se při převodu upraví na plynulou smyčku (konec se prolne do začátku) a překóduje (crf 27).
  hymna:   SRC_HYMNA  (/home/claude/hymna)    rauko.mp3, rauko_klip.mp4 (pokud je), timing.json (pokud je) → assets/hymna/
Hlasy se překódují na mono 96 kb/s (řeč, ~0,7 MB na svědka), hymna na 128 kb/s bez obrázku obalu.
Hlasy a videa se berou jen pro id z data/svedectvi.json (hráčské postavy žádné nemají).
"""
import json, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICES = os.environ.get('SRC_VOICES', '/home/claude/voices3')  # od iterace 7 anglický dabing (dřív voices2, česky)
VID = os.environ.get('SRC_VID', '/home/claude/vid')
HYMNA = os.environ.get('SRC_HYMNA', '/home/claude/hymna')
FORCE = '--force' in sys.argv
FADE = 0.8  # s, délka prolnutí konce do začátku


def newer(src, dst):
    return FORCE or not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst)


def duration(p):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True)
    return float(out.stdout.strip())


def bitrate(p):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=bit_rate', '-of', 'csv=p=0', p], capture_output=True, text=True)
    try: return int(out.stdout.strip())
    except ValueError: return 0


def mp3(src, dst, kbps=64, mono=True):
    """Řeč: mono 64 kb/s (od iterace 8 kvůli váze repa; dřív 96), bez metadat a obrázků (časy vět zůstanou, kodér přidá jen ~25 ms)."""
    tmp = dst + '.tmp.mp3'
    r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-map', '0:a:0', '-map_metadata', '-1'] + (['-ac', '1'] if mono else []) +
                       ['-c:a', 'libmp3lame', '-b:a', f'{kbps}k', tmp])
    if r.returncode: raise SystemExit('ffmpeg selhal pro ' + src)
    os.replace(tmp, dst)


def loopify(src, dst, crf=27):
    """Plynulá smyčka: out(t) = clip(t) pro t ≥ f, na začátku se přes sebe prolne clip(t+L) → clip(t); L = D − f."""
    d = duration(src)
    L = round(d - FADE, 3)
    fc = (f'[0:v]split=2[a][b];'
          f'[a]trim=start={L}:end={d},setpts=PTS-STARTPTS,format=yuva420p,fade=t=out:st=0:d={FADE}:alpha=1[tail];'
          f'[b]trim=start=0:end={L},setpts=PTS-STARTPTS,format=yuva420p[head];'
          f'[head][tail]overlay=format=auto:eof_action=pass,format=yuv420p[v]')
    tmp = dst + '.tmp.mp4'
    r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-filter_complex', fc, '-map', '[v]', '-an', '-c:v', 'libx264',
                        '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp])
    if r.returncode:
        raise SystemExit('ffmpeg selhal pro ' + src)
    os.replace(tmp, dst)


def main():
    ids = [w['id'] for w in json.load(open(ROOT + '/data/svedectvi.json', encoding='utf-8'))]
    av, avid = ROOT + '/assets/voices/', ROOT + '/assets/video/'
    os.makedirs(av, exist_ok=True); os.makedirs(avid, exist_ok=True)
    nv = nvid = 0
    for i in ids:
        s = f'{VOICES}/{i}.mp3'
        if os.path.exists(s):
            d = av + i + '.mp3'
            if newer(s, d) or bitrate(d) > 72000: mp3(s, d); nv += 1
        else:
            print('  chybí hlas:', i)
        s = f'{VID}/{i}.mp4'
        if os.path.exists(s):
            if newer(s, avid + i + '.mp4'): loopify(s, avid + i + '.mp4'); nvid += 1
        else:
            print('  chybí video:', i)
        # video v celé délce se synchronizovanými ústy (<id>_lipsync.mp4): bez smyčky, bez zvuku, řídí ho čas hlasu
        s = f'{VID}/{i}_lipsync.mp4'
        if os.path.exists(s) and newer(s, avid + i + '_plne.mp4'):
            # 1280×720, crf 33 (~1,8 MB na minutu), klíčový snímek po 2 s kvůli posuvu a dorovnání podle zvuku
            r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', s, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '33', '-g', '48',
                                '-pix_fmt', 'yuv420p', '-movflags', '+faststart', avid + i + '_plne.mp4'])
            if r.returncode: raise SystemExit('ffmpeg selhal pro ' + s)
            nvid += 1; print('  video v celé délce:', i)
    # časování vět (jen pro svědky z dat)
    tp = f'{VOICES}/timing.json'
    if os.path.exists(tp):
        t = json.load(open(tp))
        t = {k: {'duration': v['duration'], 'starts': v['starts']} | ({'ends': [l['end'] for l in v['lines']]} if v.get('lines') else {}) for k, v in t.items() if k in ids}
        json.dump(t, open(av + 'timing.json', 'w'), separators=(',', ':'))
        print(f'  timing.json: {len(t)} svědků')
        # 3D mapa má vlastní kopii textů svědků: mluvený text, české titulky a časy vět srovnat s webem
        cp = ROOT + '/public/mapa3d/data/campaign.json'
        if os.path.exists(cp):
            camp = json.load(open(cp, encoding='utf-8'))
            sv = {w['id']: w for w in json.load(open(ROOT + '/data/svedectvi.json', encoding='utf-8'))}
            for w in camp.get('witnesses', []):
                s = sv.get(w['id'])
                if not s: continue
                w['text'] = s['text']
                if s.get('titulky'): w['titulky'] = s['titulky']
                if w['id'] in t: w['t'] = t[w['id']]['starts']; w['dur'] = t[w['id']]['duration']
            open(cp, 'w', encoding='utf-8').write(json.dumps(camp, ensure_ascii=False, separators=(',', ':')))
            print('  3D mapa: texty a časy svědků srovnány')
    # odstranit média, která už nepatří do sady
    for d, ext in ((av, '.mp3'), (avid, '.mp4')):
        for f in os.listdir(d):
            if f.endswith(ext) and f[:-len(ext)].removesuffix('_plne') not in ids:
                os.remove(d + f); print('  odstraněno:', f)
    # hymna
    ah = ROOT + '/assets/hymna/'
    os.makedirs(ah, exist_ok=True)
    for name in ('rauko.mp3', 'rauko_klip.mp4', 'timing.json'):
        s = f'{HYMNA}/{name}'
        if name == 'rauko.mp3' and os.path.exists(s) and (newer(s, ah + name) or bitrate(ah + name) > 140000):
            mp3(s, ah + name, 128, mono=False); print('  hymna:', name, '128 kb/s')
        elif os.path.exists(s) and newer(s, ah + name):
            shutil.copy(s, ah + name); print('  hymna:', name)
    tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(ROOT + '/assets') for f in fs)
    print(f'hlasy: {nv} nových, videa: {nvid} nových, assets celkem {tot / 1e6:.1f} MB')


main()
