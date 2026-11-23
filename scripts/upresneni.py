#!/usr/bin/env python3
"""Upřesnění autora (23. 11. 2026), která mají přednost před zdrojovými daty kroniky.

(a) Ho s Yamohem Hokhrou a Elminster se Sar Saratarem dokončili své souboje v BITVĚ O ANAUROCH, souběžně
    s finále družiny na Pyramidě času (ne na pyramidě samotné). Yamoh po Hoově domluvě ustoupil a v dračí
    podobě zmizel i se svými lidmi, Sar Saratara Elminster rozdrtil. Rauko mezitím na vrcholu Pyramidy času
    porazil Rivalena Tanthula a rozhodl o porážce Temných.
(b) Kung Lao zemřel ve Feng Asay. Věty, podle nichž šel Ho později „za Kung Laem“ jako za živým, se upravují
    nebo vypouštějí (nic se nedomýšlí).
(c) Seung Mina byla osvobozena z Feng Asay a stala se Hoovou ženou; Khelben zmizel a nahradila ho dcera,
    jejíž jméno neznáme. (Zdrojová data to už říkají; tady se jen hlídá, že to tak zůstane.)

Použití: build-data.py volá apply_all(S, C, WD, MP) hned po načtení zdrojů; 3D mapa se opraví
`python3 scripts/upresneni.py` (přepíše public/mapa3d/data/campaign.json na místě, spouštět jde opakovaně).
"""
import json, os, sys

# přesné náhrady podřetězců ve všech textových hodnotách (stará věta → nová věta)
REPL = [
    # Broskvová zahrada je vlastní jméno místa (upřesnění autora): i zmínka z roku 1382 DR (Hoův dotaz u Li-Longa) je totéž místo
    ('ptal na broskvovou zahradu', 'ptal na Broskvovou zahradu'),
    ('ptá se na broskvovou zahradu', 'ptá se na Broskvovou zahradu'),
    ('z broskvové zahrady', 'z Broskvové zahrady'),
    # (b) Kung Lao je mrtvý, ale dosažitelný v Broskvové zahradě (upřesnění 23. 11.): rozhovory a Hoův přestup u něj zůstávají,
    #     jen se doplní, kde se odehrály
    ('Ho se vydal do Tempat Larangu za Kung Laem. ', 'Ho se vydal do Tempat Larangu za Kung Laem, který po smrti ve Feng Asay přešel do Broskvové zahrady. '),
    ('Ho mluvil s Kung Laem, pátral', 'Ho mluvil s Kung Laem v Broskvové zahradě, pátral'),
    ('Ho se vrací do Tempat Larangu, mluví s Kung Laem a zjišťuje', 'Ho se vrací do Tempat Larangu, v Broskvové zahradě mluví s Kung Laem a zjišťuje'),
    ('rozhovor s Kung Laem a rozkol řádu', 'rozhovor s Kung Laem (Broskvová zahrada) a rozkol řádu'),
    ('Yamoh Hokhra, jeho duch pak s Hoem mluvil v Tempat Larangu', 'Yamoh Hokhra; jako šedý mnich přešel do Broskvové zahrady, kde s ním Ho mluvil a u něj přestupoval'),
    # (a) souboje z třetí kapitoly proroctví skončily v bitvě o Anauroch
    ('Naplnila se třetí kapitola proroctví. Ho se se šamanem Yamohem Hokhrou nakonec nebil: přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě zmizel i se svými lidmi. Sar Saratara rozdrtil Elminster. Na vrcholu Pyramidy času svedl Rauko finální boj s Rivalenem Tanthulem',
     'Naplnila se třetí kapitola proroctví. Souběžně s finále na Pyramidě času dokončili v bitvě o Anauroch své souboje Ho a Elminster: Ho se se šamanem Yamohem Hokhrou nakonec nebil, přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě zmizel i se svými lidmi; Sar Saratara Elminster rozdrtil. Rauko mezitím na vrcholu Pyramidy času svedl finální boj s Rivalenem Tanthulem'),
    ('Družina prošla Pyramidu času až pod vrchol a tam se naplnila třetí kapitola Alaundova proroctví se svými spárovanými souboji: svatý muž z východu proti šamanovi z plání, velký mág světla proti kostěji z cizího světa. Ho se se šamanem Yamohem Hokhrou nakonec nebil: přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě zmizel i se svými lidmi. Sar Saratara rozdrtil Elminster. Na vrcholu pyramidy svedl Rauko',
     'Družina prošla Pyramidu času až pod vrchol. Souběžně s ní se v bitvě o Anauroch naplnila třetí kapitola Alaundova proroctví se svými spárovanými souboji (svatý muž z východu proti šamanovi z plání, velký mág světla proti kostěji z cizího světa), viz Bitva v Anaurochu. Na vrcholu pyramidy svedl Rauko'),
    ('V závěru po něm šel Ho, ale nebil se s ním:', 'V závěru bitvy o Anauroch, souběžně s finále na Pyramidě času, po něm šel Ho, ale nebil se s ním:'),
]
# (a) dovětek k bitvě v Anaurochu: tady souboje skončily
ANAUROCH_ADD = (' Souběžně s finále na Pyramidě času tu dokončili své souboje z třetí kapitoly Alaundova proroctví Ho a Elminster: '
                'Ho se se šamanem z plání Yamohem Hokhrou nakonec nebil, přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě '
                'zmizel i se svými lidmi; Sar Saratara, kostěje z cizího světa, Elminster rozdrtil.')
# metadata svědectví (ne namluvený text, ten se nemění): vazba k družině a stav
VAZBA = {
    'kung-lao': 'Hoův učitel na východě; padl ve Feng Asay rukou šamana Yamoha Hokhry a přešel do Broskvové zahrady, kde s ním Ho dál mluví.',
    'chuang-li': 'Hoova učitelka z Tempat Larangu a zrádkyně: na konci příběhu o Cham Fau se chtěla přidat k Temným a padla ve finálním souboji s Hoem.',
    'seung-mina': 'Hoova žena; Ho ji osvobodil z Feng Asay. S Hoem bojovala od Sid-hou po obranu tethyrských držav.',
    'yamoh-hokhra': 'Zabil Hoova učitele Kung Laa; v bitvě o Anauroch po Hoově domluvě ustoupil a v dračí podobě zmizel i se svými lidmi.',
    'sar-saratar': 'Při únosu knihovnice Arenkae se družině vysmál; v bitvě o Anauroch ho rozdrtil Elminster.',
}
STAV = {
    'kung-lao': ('padl', '† Feng Asay · Broskvová zahrada'),
    'chuang-li': ('padl', '† Cham Fau, v souboji s Ho Wu Longem'),
    'yamoh-hokhra': ('zmizel', 'zmizel v dračí podobě v bitvě o Anauroch'),
    'sar-saratar': ('padl', '† rozdrcen Elminsterem v bitvě o Anauroch'),
}


STRANA = {'chuang-li': ('nepřítel', 'nepřátelé')}  # zrádkyně


def fix_witnesses(ws, key_vazba='vazba'):
    for w in ws:
        if w.get('id') in STRANA:
            if key_vazba == 'vazba': w['strana'], w['skupina'] = STRANA[w['id']]
            else: w['side'] = STRANA[w['id']][0]
        if w.get('id') in VAZBA: w[key_vazba] = VAZBA[w['id']]
        if w.get('id') in STAV and (key_vazba == 'vazba' or 'stav' in w):
            w['stav'], w['stav_titulek'] = STAV[w['id']]
    return ws


DUEL_UNITS = ('Yamoh Hokhra, šaman z plání', 'Sar Saratar, kostěj z cizího světa')


def _walk(o, hits):
    if isinstance(o, dict):
        return {k: _walk(v, hits) for k, v in o.items()}
    if isinstance(o, list):
        return [_walk(v, hits) for v in o]
    if isinstance(o, str):
        for i, (a, b) in enumerate(REPL):
            if a in o:
                o = o.replace(a, b); hits[i] = hits.get(i, 0) + 1
    return o


def fix_battles(battles):
    """Souboje Ho × Yamoh a Elminster × Sar Saratar patří k bitvě v Anaurochu, ne k Pyramidě času."""
    moved = []
    for b in battles:
        if 'Pyramid' in b.get('name', '') and 'souboj' in b.get('name', '').lower():
            for side in b.get('sides', []):
                keep = [u for u in side.get('units', []) if u.get('unit') not in DUEL_UNITS]
                moved += [u for u in side.get('units', []) if u.get('unit') in DUEL_UNITS]
                side['units'] = keep
    for b in battles:
        if b.get('name') == 'Bitva v Anaurochu':
            if 'Souběžně s finále na Pyramidě času' not in b.get('summary', ''):
                b['summary'] = b.get('summary', '') + ANAUROCH_ADD
            if len(b.get('sides', [])) > 1:
                have = {u.get('unit') for u in b['sides'][1].get('units', [])}
                for u in moved or [{'unit': x, 'count': '1', 'commander': '—'} for x in DUEL_UNITS]:
                    if u['unit'] not in have: b['sides'][1].setdefault('units', []).append(u)
                cm = b['sides'][1].setdefault('commanders', [])
                if 'Sar Saratar' not in cm: cm.append('Sar Saratar')
    return battles


def fix_characters(chars):
    for c in chars:
        if c.get('id') == 'kung-lao':
            # (b) „rozhovor“ s Kung Laem roku 1384 DR vypustit: Kung Lao padl ve Feng Asay 1377 DR
            for m in c.get('milestones', []):
                if 'Rozhovor v Tempat Larangu' in m.get('title', '') and 'Broskvov' not in m.get('text', ''):
                    m['text'] = 'V Broskvové zahradě, kam po smrti přešel: ' + m['text'][:1].lower() + m['text'][1:]
            c['fate'] = 'Padl ve Feng Asay a přešel do Broskvové zahrady, laoneyského nebe, kde ho lze vyhledat a mluvit s ním; jeho klobouk nosí Ho.'
            c['status'] = 'padl'
        if c.get('id') == 'yamoh-hokhra':
            c['status'] = 'zmizel'
        if c.get('id') == 'sar-saratar':
            c['status'] = 'padl'
    return chars


NPC_ADD = {  # jméno v npcs.json → věta doplněná na konec popisu (upřesnění 23. 11.), případně nový „when“
    'Chuang-li': ('; zrádkyně: na konci příběhu o Cham Fau se chtěla přidat k Temným a padla ve finálním souboji s Hoem; v Broskvové zahradě není', 'Temným'),
    'Wang Fei-Hung': ('; byl vězněm Chuang-li, jeho tělo už nešlo zachránit, a tak se astrálně přesunul do Broskvové zahrady', 'Broskvov'),
    'lord Ryden': ('; zemřel při prošetřování Cham Fau rukou Chuang-li', 'Chuang'),
    'Arduna': ('; vedle Hoa jediný dosud žijící šedý mnich', 'jediný'),
    'Lei Wu-Long': ('; je v Broskvové zahradě', 'Broskvov'),
}


def fix_npcs(N):
    for n in N or []:
        add = NPC_ADD.get(n.get('name'))
        if add and add[1] not in n.get('who', '') + n.get('when', ''):
            n['who'] = n.get('who', '').rstrip('.') + add[0]
    return N


def apply_all(S=None, C=None, WD=None, MP=None, N=None, verbose=True):
    hits = {}
    out = []
    for o in (S, C, WD, MP, N):
        out.append(_walk(o, hits) if o is not None else None)
    S, C, WD, MP, N = out
    if WD is not None: fix_battles(WD.get('battles', []))
    if C is not None: fix_characters(C)
    if N is not None: fix_npcs(N)
    if verbose:
        miss = [REPL[i][0][:60] for i in range(len(REPL)) if i not in hits]
        print(f'  upřesnění autora: {sum(hits.values())} náhrad' + (f'; {len(miss)} vět už zdroj obsahuje opravené' if miss else ''))
    return (S, C, WD, MP) if N is None else (S, C, WD, MP, N)


if __name__ == '__main__':
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'mapa3d', 'data', 'campaign.json')
    camp = json.load(open(p, encoding='utf-8'))
    hits = {}
    camp = _walk(camp, hits)
    fix_battles(camp.get('battles', []))
    fix_witnesses(camp.get('witnesses', []), 'bond')
    txt = json.dumps(camp, ensure_ascii=False, separators=(',', ':'))
    open(p, 'w', encoding='utf-8').write(txt)
    print('campaign.json:', sum(hits.values()), 'náhrad', file=sys.stderr)
