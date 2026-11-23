// Typografie: za jednopísmennou předložkou/spojkou a mezi číslem a jednotkou patří nezlomitelná mezera.
const RX1 = /(^|[\s(„“–—])([KkSsVvZzOoUuAaIi]) (?=\S)/g;
const RX2 = /(\d) (?=(?:DR|let|roků|dní|minut|MB|kB|m|km|%)\b)/g;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);
function fix(t) { return t.replace(RX1, '$1$2 ').replace(RX1, '$1$2 ').replace(RX2, '$1 '); }
function walk(n) {
  if (n.nodeType === 3) {
    const v = n.nodeValue;
    if (v.length > 2 && v.includes(' ')) { const w = fix(v); if (w !== v) n.nodeValue = w; }
  } else if (n.nodeType === 1 && !SKIP.has(n.tagName)) for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
}
export function startNbsp(root = document.body) {
  walk(root);
  new MutationObserver((ms) => {
    for (const m of ms) {
      m.addedNodes.forEach((a) => walk(a));
      if (m.type === 'characterData' && m.target.parentNode && !SKIP.has(m.target.parentNode.tagName)) {
        const v = m.target.nodeValue, w = fix(v); if (w !== v) m.target.nodeValue = w;
      }
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
