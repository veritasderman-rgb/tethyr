"""Vyprávění ke kapitolám Příběhu: data/vypraveni/*.md → bloky pro web (public/data/vypraveni.json).

Formát zdroje (ručně psané, fakta z dat kroniky a z textů hráčů):
  ## <id kapitoly>
  Odstavec … [text](w:svědek) [text](m:místo) [text](b:bitva) [text](p:2-8) [text](c:postava) [text](s:sezení) {s-2005-12}
  (prázdný řádek odděluje odstavce; {s-…} na konci = marginálie: datum u stolu a ve hře)
  > citace z textu hráče
  > — Jméno, název textu
Řádky začínající „# “ jsou poznámky.
"""
import glob, os, re

LINK = re.compile(r'\[([^\]]+)\]\(([wmbpcs]):([^)]+)\)')
FORBID = re.compile(r'Granan|Silverkin|Schamedar|Wu Lej|Třešňák|Kubás|Zerzan|Zerzán|Lukač|Krčm|Tetek|Pavlovi|@|https?://|tapisér|v srdci', re.I)
KDO = {'Pepa', 'Lukáš', 'Vojta', 'Zdeněk T.', 'Zdeněk K.', 'Terka', 'Tomáš', 'Venca', 'Jana'}


def parse(folder):
    """Vrátí {id kapitoly: [blok, …]}; blok = {'p': text, 's': id sezení?} nebo {'q': text, 'kdo': jméno, 'zdroj': text}."""
    out, cur = {}, None
    for f in sorted(glob.glob(os.path.join(folder, '*.md'))):
        paras, buf = [], []
        for line in open(f, encoding='utf-8').read().split('\n'):
            if line.startswith('## '):
                if buf: paras.append((cur, buf)); buf = []
                cur = line[3:].strip(); out.setdefault(cur, [])
                continue
            if line.startswith('# ') or line.strip() == '#':
                continue
            if not line.strip():
                if buf: paras.append((cur, buf)); buf = []
                continue
            buf.append(line.rstrip())
        if buf: paras.append((cur, buf))
        for ch, lines in paras:
            if ch is None: continue
            if lines[0].startswith('>'):
                q = [l.lstrip('>').strip() for l in lines]
                sig = q[-1] if q[-1].startswith('—') else ''
                body = ' '.join(q[:-1] if sig else q)
                kdo, _, zdroj = sig.lstrip('— ').partition(',')
                out[ch].append({'q': body, 'kdo': kdo.strip(), 'zdroj': zdroj.strip()})
            else:
                t = ' '.join(lines)
                m = re.search(r'\s*\{([^}]+)\}\s*$', t)
                b = {'p': t[:m.start()] if m else t}
                if m: b['s'] = [x.strip() for x in m.group(1).split(',')]
                out[ch].append(b)
    return out


def words(blocks):
    n = 0
    for b in blocks:
        n += len(LINK.sub(r'\1', b.get('p') or b.get('q') or '').split())
    return n


def validate(V, chapters, ids):
    """ids: dict druh → množina platných id. Vypíše problémy, vrátí jejich počet."""
    bad = 0
    chids = {c['id'] for c in chapters}
    for ch, blocks in V.items():
        if ch not in chids:
            print('  !! vyprávění: neznámá kapitola', ch); bad += 1
        np = sum(1 for b in blocks if 'p' in b)
        if not 4 <= np <= 8:
            print(f'  !! vyprávění {ch}: {np} odstavců (má být 4–8)'); bad += 1
        for b in blocks:
            t = b.get('p') or b.get('q') or ''
            for kind, i in [(k, x) for _, k, x in LINK.findall(t)]:
                if i not in ids.get(kind, ()):
                    print(f'  !! vyprávění {ch}: neznámý odkaz {kind}:{i}'); bad += 1
            for s in b.get('s', []):
                if s not in ids['s']:
                    print(f'  !! vyprávění {ch}: neznámé sezení {s}'); bad += 1
            hit = FORBID.findall(t)
            if hit:
                print(f'  !! vyprávění {ch}: zakázané {set(hit)}'); bad += 1
            if 'p' in b and '?' in LINK.sub('', t):
                print(f'  !! vyprávění {ch}: otazník (řečnická otázka?) v odstavci'); bad += 1
            if 'q' in b and b['kdo'] not in KDO:
                print(f'  !! vyprávění {ch}: citace bez hráče/PJ jako autora: {b["kdo"]!r}'); bad += 1
    for c in chapters:
        if c['id'] not in V:
            print('  !! kapitola bez vyprávění:', c['id']); bad += 1
    return bad
