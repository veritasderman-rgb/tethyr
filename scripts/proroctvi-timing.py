#!/usr/bin/env python3
"""Časování namluveného Alaundova proroctví (hlas „Alaundo“, česky).

kap1.mp3–kap3.mp3 = úvodní trojverší kapitoly + všechna dvojverší v pořadí podle
tethyr/public/data/prophecy.json. faster-whisper (word timestamps, jazyk cs) -> zarovnání slov
na jednotky (trojverší, verše) přes difflib; jednotky bez nalezeného slova se dopočítají úměrně
podle počtu znaků mezi sousedy; když se zarovná méně než 40 % slov, celé úměrně.
Výstup: timing.json {"1": {"duration": s, "units": [{"start": s, "end": s}, ...]}, ...}
(units[0] = trojverší, units[1..] = verše), wer_report.json.
Použití: python3 make_timing.py [small|medium]
"""
import json, re, sys, difflib, os, subprocess as sp, unicodedata
import numpy as np
from faster_whisper import WhisperModel

H = os.environ.get('SRC_PROROCTVI', '/home/claude/proroctvi')  # kap1–3.mp3; výstup timing.json tamtéž
P = json.load(open(os.environ.get('PROPHECY', '/home/claude/tethyr/public/data/prophecy.json')))
MODEL = sys.argv[1] if len(sys.argv) > 1 else 'small'


def load(p):
    raw = sp.check_output(['ffmpeg', '-v', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'])
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def norm(w):
    w = unicodedata.normalize('NFD', w.lower())
    w = ''.join(c for c in w if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', w)


def toks(s):
    s = re.sub(r'[–—…|\-]', ' ', s.replace('\xa0', ' '))
    return [t for t in (norm(x) for x in s.split()) if t]


def dur_of(p):
    return float(sp.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]))


m = WhisperModel(MODEL, device='cpu', compute_type='int8', cpu_threads=os.cpu_count() or 2)
out, rep = {}, {}
for c in P['chapters']:
    n = c['n']
    f = f'{H}/kap{n}.mp3'
    units = [' '.join(c['tercet'])] + [' '.join(v['t']) for v in c['verses']]
    ref, un = [], []
    for k, u in enumerate(units):
        for t in toks(u):
            ref.append(t); un.append(k)
    segs, info = m.transcribe(load(f), language='cs', word_timestamps=True, beam_size=5,
                              condition_on_previous_text=False, vad_filter=False)
    hyp, ht, full = [], [], []
    for s in segs:
        full.append(s.text)
        for w in s.words:
            for t in toks(w.word):
                hyp.append(t); ht.append((w.start, w.end))
    D = dur_of(f)
    sm = difflib.SequenceMatcher(None, ref, hyp, autojunk=False)
    rt = [None] * len(ref)
    for tag, a1, a2, b1, b2 in sm.get_opcodes():
        if tag == 'equal' or (tag == 'replace' and a2 - a1 == b2 - b1):
            for d in range(a2 - a1):
                rt[a1 + d] = ht[b1 + d]
    L = len(units); st = [None] * L; en = [None] * L
    # začátek jednotky = první přiřazené slovo mezi prvními třemi slovy (jinak ji necháme dopočítat)
    first = {}
    for i, k in enumerate(un):
        first.setdefault(k, i)
    for i, k in enumerate(un):
        if rt[i]:
            if st[k] is None and i - first[k] < 3:
                st[k] = rt[i][0] - (0.12 * (i - first[k]))
            en[k] = rt[i][1]
    matched = sum(1 for r in rt if r)
    method = 'align'
    if matched < 0.4 * len(ref):
        method = 'proportional'
        tot = sum(len(u) for u in units); acc = 0
        for k, u in enumerate(units):
            st[k] = D * acc / tot; acc += len(u); en[k] = D * acc / tot
    else:
        # monotónnost: start, který jde proti pořadí, zahodit
        last = -1
        for k in range(L):
            if st[k] is not None:
                if st[k] <= last: st[k] = None
                else: last = st[k]
        for k in range(L):
            if st[k] is None:
                p = max([j for j in range(k) if st[j] is not None], default=None)
                q = min([j for j in range(k + 1, L) if st[j] is not None], default=None)
                grp = [j for j in range(L) if st[j] is None and (p is None or j > p) and (q is None or j < q)]
                t0 = (en[p] if (p is not None and en[p]) else (st[p] if p is not None else 0.0))
                t1 = st[q] if q is not None else D
                tot = sum(len(units[j]) for j in grp) or 1; acc = 0
                for j in grp:
                    st[j] = t0 + (t1 - t0) * acc / tot; acc += len(units[j])
        method = 'align' if all(x is not None for x in st) else method
    st[0] = min(st[0], 0.4) if st[0] is not None else 0.0
    res = []
    for k in range(L):
        e = st[k + 1] if k + 1 < L else D
        res.append({'start': round(max(0, st[k]), 2), 'end': round(e, 2)})
    out[str(n)] = {'duration': round(D, 2), 'units': res}
    rep[str(n)] = {'model': MODEL, 'metoda': method, 'prirazeno_slov': f'{matched}/{len(ref)}',
                   'jednotek': L, 'prepis': ' '.join(x.strip() for x in full)}
    print(n, method, rep[str(n)]['prirazeno_slov'], flush=True)
json.dump(out, open(f'{H}/timing.json', 'w'), ensure_ascii=False, indent=1)
json.dump(rep, open(f'{H}/wer_report.json', 'w'), ensure_ascii=False, indent=1)
