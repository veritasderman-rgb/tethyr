#!/usr/bin/env python3
"""Upřesnění autora (23. 11. 2026), která mají přednost před zdrojovými daty kroniky.

(a) Bitva o Anauroch a finále (upřesnění 23. 11., opraveno v iteraci 10): finále na Pyramidě času je SOUČÁSTÍ
    bitvy o Anauroch. Na vrcholu pyramidy porazil Rauko svého úhlavního soka Rivalena Tanthula a rozhodl o porážce
    Temných; Ho Wu Long bojoval po jeho boku a s Arwin („Devátá“ z proroctví) systematicky ničil Clariburnuse.
    V téže bitvě Yamoh Hokhra po Hoově domluvě ustoupil a v dračí podobě zmizel i se svými lidmi (čas a místo
    rozhovoru se neupřesňují) a Sar Saratara rozdrtil Elminster. Iterace 9 mylně tvrdila, že Ho byl při finále
    jinde; tady se to vrací (i v textech, které už iterace 9 přepsala, např. v 3D mapě).
(b) Kung Lao zemřel ve Feng Asay. Věty, podle nichž šel Ho později „za Kung Laem“ jako za živým, se upravují
    nebo vypouštějí (nic se nedomýšlí).
(c) Seung Mina byla osvobozena z Feng Asay a stala se Hoovou ženou; Khelben zmizel a nahradila ho dcera,
    jejíž jméno neznáme. (Zdrojová data to už říkají; tady se jen hlídá, že to tak zůstane.)

Použití: build-data.py volá apply_all(S, C, WD, MP) hned po načtení zdrojů; 3D mapa se opraví
`python3 scripts/upresneni.py` (přepíše public/mapa3d/data/campaign.json na místě, spouštět jde opakovaně).
"""
import json, os, sys

FIN_NEW = ('Naplnila se třetí kapitola proroctví. V bitvě o Anauroch, jejíž součástí bylo i finále na Pyramidě času, dohráli své souboje Ho a Elminster: '
           'Ho se se šamanem Yamohem Hokhrou nakonec nebil, přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě zmizel i se svými lidmi; Sar Saratara Elminster rozdrtil. '
           'Na vrcholu Pyramidy času svedl Rauko finální boj s Rivalenem Tanthulem')
PYR_NEW = ('Družina prošla Pyramidu času až pod vrchol. Finále na pyramidě bylo součástí bitvy o Anauroch, v níž se naplnila třetí kapitola Alaundova proroctví se svými '
           'spárovanými souboji (svatý muž z východu proti šamanovi z plání, velký mág světla proti kostěji z cizího světa), viz Bitva v Anaurochu. Na vrcholu pyramidy svedl Rauko')
# dovětek iterace 9 (nahrazuje se novým ANAUROCH_ADD)
ANAUROCH_OLD = (' Souběžně s finále na Pyramidě času tu dokončili své souboje z třetí kapitoly Alaundova proroctví Ho a Elminster: '
                'Ho se se šamanem z plání Yamohem Hokhrou nakonec nebil, přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě '
                'zmizel i se svými lidmi; Sar Saratara, kostěje z cizího světa, Elminster rozdrtil.')
# přesné náhrady podřetězců ve všech textových hodnotách (stará věta → nová věta)
REPL = [
    # (a) Ho byl na vrcholu Pyramidy času (iterace 10): zdrojové věty zůstávají, věty přepsané iterací 9 se vracejí
    ('Po vítězné bitvě v Anaurochu po nich Rauko a Ho šli ulicemi Města stínů až na vrchol Chronosovy pyramidy. S Rivalenem tam svedl finální boj Rauko',
     'Po nich šli Rauko a Ho ulicemi Města stínů až na vrchol Chronosovy pyramidy, kde se dohrálo finále bitvy o Anauroch. S Rivalenem tam svedl finální boj Rauko'),
    ('Po nich šel Rauko ulicemi Města stínů až na vrchol Chronosovy pyramidy, zatímco Ho v téže době dokončoval v bitvě o Anauroch svůj souboj. S Rivalenem na vrcholu svedl finální boj Rauko',
     'Po nich šli Rauko a Ho ulicemi Města stínů až na vrchol Chronosovy pyramidy, kde se dohrálo finále bitvy o Anauroch. S Rivalenem tam svedl finální boj Rauko'),
    ('z města začala honba za stínem. Na vrcholu Chronosovy pyramidy ji dokončil Rauko, Ho byl mezitím v bitvě o Anauroch.',
     'z města začala honba za stínem, která skončila na vrcholu Chronosovy pyramidy.'),
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
    # (a) souboje z třetí kapitoly proroctví: v bitvě o Anauroch, jejíž součástí bylo i finále na pyramidě
    ('Naplnila se třetí kapitola proroctví. Ho se se šamanem Yamohem Hokhrou nakonec nebil: přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě zmizel i se svými lidmi. Sar Saratara rozdrtil Elminster. Na vrcholu Pyramidy času svedl Rauko finální boj s Rivalenem Tanthulem',
     FIN_NEW),
    ('Naplnila se třetí kapitola proroctví. Souběžně s finále na Pyramidě času dokončili v bitvě o Anauroch své souboje Ho a Elminster: Ho se se šamanem Yamohem Hokhrou nakonec nebil, přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě zmizel i se svými lidmi; Sar Saratara Elminster rozdrtil. Rauko mezitím na vrcholu Pyramidy času svedl finální boj s Rivalenem Tanthulem',
     FIN_NEW),
    ('Družina prošla Pyramidu času až pod vrchol a tam se naplnila třetí kapitola Alaundova proroctví se svými spárovanými souboji: svatý muž z východu proti šamanovi z plání, velký mág světla proti kostěji z cizího světa. Ho se se šamanem Yamohem Hokhrou nakonec nebil: přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě zmizel i se svými lidmi. Sar Saratara rozdrtil Elminster. Na vrcholu pyramidy svedl Rauko',
     PYR_NEW),
    ('Družina prošla Pyramidu času až pod vrchol. Souběžně s ní se v bitvě o Anauroch naplnila třetí kapitola Alaundova proroctví se svými spárovanými souboji (svatý muž z východu proti šamanovi z plání, velký mág světla proti kostěji z cizího světa), viz Bitva v Anaurochu. Na vrcholu pyramidy svedl Rauko',
     PYR_NEW),
    ('Družina prošla Pyramidu času až pod vrchol a tam se naplnila třetí kapitola Alaundova proroctví. Její spárované souboje, svatý muž z východu proti šamanovi z plání a velký mág světla proti kostěji z cizího světa, se souběžně dohrály v bitvě o Anauroch:',
     'Družina prošla Pyramidu času až pod vrchol. Finále na pyramidě bylo součástí bitvy o Anauroch, v níž se naplnila třetí kapitola Alaundova proroctví. Její spárované souboje, svatý muž z východu proti šamanovi z plání a velký mág světla proti kostěji z cizího světa, se v téže bitvě dohrály takto:'),
    ('Na vrcholu pyramidy mezitím Rauko porazil Rivalena Tanthula a rozhodl o porážce Temných; padli princové Stínu Rivalen a Clariburnus',
     'Na vrcholu pyramidy porazil Rauko svého úhlavního soka Rivalena Tanthula a rozhodl o porážce Temných, zatímco Ho po jeho boku s Arwin, „Devátou“ z proroctví, systematicky ničil Clariburnuse; padli oba princové Stínu'),
    ('Rauko porazil Rivalena Tanthula a rozhodl o porážce Temných; padli princové Stínu Rivalen a Clariburnus',
     'Rauko porazil Rivalena Tanthula a rozhodl o porážce Temných a Ho po jeho boku s Arwin zničil Clariburnuse; padli oba princové Stínu'),
    ('Rivalena tam porazil Rauko a rozhodl o porážce Temných, zatímco v bitvě o Anauroch Yamoh',
     'Rivalena tam porazil Rauko a rozhodl o porážce Temných, Clariburnuse zničil Ho s Arwin; v téže bitvě o Anauroch Yamoh'),
    ('porazí Rauko Rivalena Tanthula a rozhodne o porážce Temných; padají princové Stínu Rivalen a Clariburnus.',
     'porazí Rauko Rivalena Tanthula a rozhodne o porážce Temných, Ho s Arwin zničí Clariburnuse; padají oba princové Stínu.'),
    ('V závěru bitvy o Anauroch, souběžně s finále na Pyramidě času, po něm šel Ho, ale nebil se s ním:', 'V bitvě o Anauroch po něm šel Ho, ale nebil se s ním:'),
    ('V závěru po něm šel Ho, ale nebil se s ním:', 'V bitvě o Anauroch po něm šel Ho, ale nebil se s ním:'),
    ('rozhodl tam o porážce Temných; padli princové Stínu Rivalen a Clariburnus',
     'rozhodl tam o porážce Temných, zatímco Ho po jeho boku s Arwin systematicky ničil Clariburnuse; padli oba princové Stínu'),
    ('svedl Rauko finální boj s Rivalenem Tanthulem a rozhodl o porážce Temných; padli princové Stínu Rivalen a Clariburnus',
     'svedl Rauko finální boj s Rivalenem Tanthulem a rozhodl o porážce Temných a Ho po jeho boku s Arwin zničil Clariburnuse; padli oba princové Stínu'),
    (ANAUROCH_OLD, ''),
]
# (a) dovětek k bitvě v Anaurochu: tady souboje skončily
ANAUROCH_ADD = (' Součástí bitvy bylo i finále na Pyramidě času, kde Rauko porazil Rivalena Tanthula a Ho s Arwin zničil Clariburnuse. V téže bitvě dohráli své souboje z třetí kapitoly Alaundova proroctví Ho a Elminster: '
                'Ho se se šamanem z plání Yamohem Hokhrou nakonec nebil, přesvědčil ho, že boj je ztracen, a Yamoh v dračí podobě '
                'zmizel i se svými lidmi; Sar Saratara, kostěje z cizího světa, Elminster rozdrtil.')
# metadata svědectví (ne namluvený text, ten se nemění): vazba k družině a stav
VAZBA = {
    'rivalen': 'Raukův osobní nepřítel a poslední soupeř družiny; Rauko ho pronásledoval z Thultantharu až na vrchol Pyramidy času, kde ho porazil a rozhodl o porážce Temných.',
    'arwin': '„Devátá“ z Alaundova proroctví. Družina si ji roku 1384 odvedla ze základny en Rewin; na vrcholu Pyramidy času s Hoem systematicky ničila Clariburnuse, zatímco Rauko porazil Rivalena. V epilogu je s Raukem ve zbroji Zeleného anděla.',
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


# jednotný tvar jmen (iterace 9): kniha i data používala několik pravopisů téhož jména
import re
NAME_RX = [
    (re.compile(r'Jamah[ -]Hogr(a|ovi|u|ou|ovo|y|o|e)\b'), lambda m: {'a': 'Yamoh Hokhra', 'ovi': 'Yamohu Hokhrovi', 'u': 'Yamohu Hokhrovi', 'ou': 'Yamohem Hokhrou', 'y': 'Yamoha Hokhry', 'o': 'Yamoh Hokhra', 'e': 'Yamohu Hokhrovi', 'ovo': 'Yamohovo'}[m.group(1)]),
    (re.compile(r'Yamoh Hokra\b'), 'Yamoh Hokhra'),
    (re.compile(r'Chuang Li\b'), 'Chuang-Li'),
    (re.compile(r'Chuang-li\b'), 'Chuang-Li'),
    (re.compile(r'Wang Fei-hung'), 'Wang Fei-Hung'),
    (re.compile(r'\blord (Ryden\w*)'), r'Lord \1'),
    (re.compile(r'\blorda (Ryden\w*)'), r'Lorda \1'),
    (re.compile(r'\blordu (Ryden\w*)'), r'Lordu \1'),
]


def norm_names(t):
    for rx, rep in NAME_RX:
        t = rx.sub(rep, t)
    t = re.sub(r'(?<=[a-zěščřžýáíéúůďťň]),(?=[A-Za-zÁ-ž])', ', ', t)   # chybějící mezera po čárce
    return t


def _walk(o, hits):
    if isinstance(o, dict):
        return {k: _walk(v, hits) for k, v in o.items()}
    if isinstance(o, list):
        return [_walk(v, hits) for v in o]
    if isinstance(o, str):
        o = norm_names(o)
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
        # Ho byl na vrcholu Pyramidy času po Raukově boku (iterace 10; iterace 9 ho odtud mylně odebrala)
        if 'Pyramid' in b.get('name', '') and 'souboj' in b.get('name', '').lower() and b.get('sides'):
            s0 = b['sides'][0]
            cm = s0.setdefault('commanders', [])
            if 'Ho Wu Long' not in cm: cm.insert(1 if 'Rauko Daerond' in cm else 0, 'Ho Wu Long')
            us = s0.setdefault('units', [])
            if not any(u.get('unit') == 'Ho Wu Long' for u in us):
                us.insert(1 if us and us[0].get('unit') == 'Rauko Daerond' else 0, {'unit': 'Ho Wu Long', 'count': '1', 'commander': '—'})
    for b in battles:
        if b.get('name') == 'Bitva v Anaurochu':
            if 'Součástí bitvy bylo i finále' not in b.get('summary', ''):
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
            c['fate'] = 'Padl ve Feng Asay a přešel do Broskvové zahrady, laoneyského nebe, kde ho lze vyhledat a mluvit s ním; jeho klobouk nosil Ho až do posledního přestupu, kdy ho odložil.'
            c['status'] = 'padl'
        if c.get('id') == 'ho':
            c['aliases'] = [a for a in c.get('aliases', []) if a != 'Ho Wu Lung']   # jméno je vždy „Ho Wu Long“
            for m in c.get('milestones', []):
                if m.get('title') == 'Thultanthar a Pyramida času' and 'Clarib' not in m.get('text', ''):
                    m['text'] = m['text'].replace('V ulicích Města stínů a na vrcholu Chronosovy pyramidy padli princové Stínu.',
                                                  'Na vrcholu Chronosovy pyramidy bojoval po Raukově boku a s Arwin systematicky ničil prince Stínu Clariburnuse, zatímco Rauko porazil Rivalena; padli oba princové.')
        if c.get('id') == 'arwin' and 'Devátá' not in c.get('aliases', []):
            c['aliases'] = c.get('aliases', []) + ['Devátá']   # proroctví 3-1 „Ke Strážcům nepatří, devátá z desíti“ (výklad z her: Arwin)
        if c.get('id') == 'princove-stinu':
            if 'Clarib' not in c.get('fate', '').split('Rauko', 1)[-1]:
                c['fate'] = c.get('fate', '').rstrip() + ' Clariburnuse tam po Raukově boku systematicky ničil Ho s Arwin.'
            for m in c.get('milestones', []):
                if m.get('title') == 'Poslední souboj' and 'Arwin' not in m.get('text', ''):
                    m['text'] = m['text'].replace('; oba princové padli.', ', Ho s Arwin zničil Clariburnuse; oba princové padli.')
        if c.get('id') == 'yamoh-hokhra':
            c['status'] = 'zmizel'
        if c.get('id') == 'sar-saratar':
            c['status'] = 'padl'
    return chars


NPC_ADD = {  # jméno v npcs.json → věta doplněná na konec popisu (upřesnění 23. 11.), případně nový „when“
    'Chuang-Li': ('; zrádkyně: na konci příběhu o Cham Fau se chtěla přidat k Temným a padla ve finálním souboji s Hoem; v Broskvové zahradě není', 'Temným'),
    'Wang Fei-Hung': ('; byl vězněm Chuang-Li, jeho tělo už nešlo zachránit, a tak se astrálně přesunul do Broskvové zahrady', 'Broskvov'),
    'lord Ryden': ('; zemřel při prošetřování Cham Fau rukou Chuang-Li', 'Chuang'),
    'Arduna': ('; vedle Hoa jediný dosud žijící šedý mnich', 'jediný'),
    'Lei Wu-Long': ('; je v Broskvové zahradě', 'Broskvov'),
    'Clariburnus Tanthul': ('; na vrcholu Pyramidy času ho po Raukově boku systematicky ničil Ho Wu Long s Arwin', 'Arwin'),
    'Arwin en Rewin': ('; „Devátá“ z Alaundova proroctví', 'Devátá'),
}


NPC_ADD_L = {k.lower(): v for k, v in NPC_ADD.items()}


def fix_npcs(N):
    for n in N or []:
        add = NPC_ADD_L.get((n.get('name') or '').lower())
        if add and add[1] not in n.get('who', '') + n.get('when', ''):
            n['who'] = n.get('who', '').rstrip('.') + add[0]
        if (n.get('name') or '') == 'Arwin en Rewin' and 'Devátá' not in (n.get('aliases') or []):
            n['aliases'] = (n.get('aliases') or []) + ['Devátá']
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
    def _npc3d(o):  # 3D mapa má u míst seznamy osob {n, w, k}: stejné dovětky jako npcs.json
        if isinstance(o, dict):
            add = NPC_ADD_L.get(str(o.get('n', '')).lower())
            if add and isinstance(o.get('w'), str) and add[1] not in o['w']: o['w'] = o['w'].rstrip('.') + add[0]
            for v in o.values(): _npc3d(v)
        elif isinstance(o, list):
            for v in o: _npc3d(v)
    _npc3d(camp)
    txt = json.dumps(camp, ensure_ascii=False, separators=(',', ':'))
    open(p, 'w', encoding='utf-8').write(txt)
    print('campaign.json:', sum(hits.values()), 'náhrad', file=sys.stderr)
