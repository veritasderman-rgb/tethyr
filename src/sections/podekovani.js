// 12. Poděkování Pánu jeskyně (text přesně podle podekovani.txt) a fotka od stolu.
import TXT from '../../data/podekovani.txt?raw';
import { img } from '../lib/img.js';
import { $, esc } from '../lib/util.js';

export function renderPodekovani() {
  const el = $('#podekovani');
  const lines = TXT.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const title = lines.shift();
  const paras = []; let cur = [];
  for (const l of lines) { if (l) cur.push(l); else if (cur.length) { paras.push(cur.join(' ')); cur = []; } }
  if (cur.length) paras.push(cur.join(' '));
  const sign = paras.pop();         // „Všichni vděční hráči“
  const to = paras.shift();         // „Zdeňku,“
  const last = paras.pop();         // „Tahle kronika je tvoje stejně jako naše.“
  el.innerHTML = `<header class="sec-head"><p class="kicker">Na závěr</p><h1 id="podekovani-h" tabindex="-1">${esc(title)}</h1><div class="orn">✦</div></header>
    <div class="pd-letter">
      <p class="pd-to rv">${esc(to)}</p>
      ${paras.map((p, i) => `<p class="rv d${i % 3}">${esc(p)}</p>`).join('')}
      <p class="pd-last rv">${esc(last)}</p>
      <p class="pd-sign rv">${esc(sign)}</p>
    </div>
    <figure class="pd-foto rv"><div class="pic">${img('foto/005', { alt: 'Hráči u stolu: zleva Zdeněk T., Pepa, Zdeněk K. a Lukáš, 26. dubna 2013.', sizes: '(max-width:900px) 92vw, 900px' })}</div><figcaption>U stolu, 26. dubna 2013. Zleva Zdeněk T., Pepa, Zdeněk K. a Lukáš.</figcaption></figure>`;
}
