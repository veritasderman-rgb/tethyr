"""Vyprávění ke kapitolám Příběhu: data/vypraveni/*.md → bloky pro web (public/data/vypraveni.json).

Formát zdroje (ručně psané, fakta z dat kroniky a z textů hráčů):
  ## <id kapitoly>
  Odstavec … [text](w:svědek) [text](m:místo) [text](b:bitva) [text](p:2-8) [text](c:postava) [text](s:sezení) {s-2005-12}
  (prázdný řádek odděluje odstavce; {s-…} na konci = marginálie: datum u stolu a ve hře)
  > citace z textu hráče
  > — Jméno, název textu
Řádky začínající „# “ jsou poznámky.

Odkazy x: na hesla Lexikonu doplňuje automaticky scripts/build-lexikon.py (první výskyt jména v odstavci);
ručně je psát nemusíte. Kontrola (validate) hlídá i to, že marginálie {s-…} patří ke kapitole a že
kapitola nemá méně než MIN_WORDS slov (u řídce zapsaných kapitol je výjimka v SPARSE: zdroje mlčí).
"""
import glob, os, re

LINK = re.compile(r'\[([^\]]+)\]\(([wmbpcsx]):([^)]+)\)')
FORBID = re.compile(r'Granan|Silverkin|Schamedar|Wu Lej|Třešňák|Kubás|Zerzan|Zerzán|Lukač|Krčm|Tetek|Pavlovi|@|https?://|tapisér|v srdci', re.I)
MIN_WORDS = 160
# kapitoly, kde zdroje (sezení, svět, postavy, texty hráčů, deník mistra Ho, kniha v12) víc neříkají
SPARSE = set()  # od iterace 7 mají všechny kapitoly aspoň MIN_WORDS slov (doplněno z dat postav, NPC a bitev)
# marginálie se sezením jiné kapitoly, kde je to oprávněné (s-2006 shrnuje celé tažení Shou Lungem)
SHARED = {('ch-shou-lung-a-velke-tazeni', 's-2006')}
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
    sess_of = {c['id']: set(c.get('sessions', [])) for c in chapters}
    for ch, blocks in V.items():
        own = sess_of.get(ch, set())
        for b in blocks:
            for s in b.get('s', []):
                if own and s not in own and (ch, s) not in SHARED:
                    print(f'  !! vyprávění {ch}: marginálie {s} nepatří ke kapitole'); bad += 1
            if 'q' in b and not b.get('zdroj'):
                print(f'  !! vyprávění {ch}: citace bez názvu zdroje'); bad += 1
        n = words(blocks)
        if n < MIN_WORDS and ch not in SPARSE:
            print(f'  !! vyprávění {ch}: jen {n} slov (minimum {MIN_WORDS}, jinak zapsat do SPARSE)'); bad += 1
    for c in chapters:
        if c['id'] not in V:
            print('  !! kapitola bez vyprávění:', c['id']); bad += 1
    return bad


def report(V):
    """Počty slov a odstavců po kapitolách (python3 scripts/vypraveni.py)."""
    for ch, blocks in V.items():
        np = sum(1 for b in blocks if 'p' in b); nq = sum(1 for b in blocks if 'q' in b)
        print(f'{ch:42s} {words(blocks):4d} slov  {np} odst.  {nq} cit.{"  (zdroje mlčí)" if ch in SPARSE else ""}')


if __name__ == '__main__':
    report(parse(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'vypraveni')))
