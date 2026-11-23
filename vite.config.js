import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Svědectví: audio a video dodá zadavatel do assets/voices/<id>.mp3 a assets/video/<id>.mp4.
// Plugin z nich udělá manifest (virtual:media), aby web věděl, co existuje, a při buildu je zkopíruje do dist/.
const MEDIA = { voices: /\.(mp3|m4a|ogg|wav)$/i, video: /\.(mp4|webm)$/i, hymna: /\.(mp3|mp4|webm|json)$/i, proroctvi: /\.mp3$/i };
function ls(dir, re) {
  try { return fs.readdirSync(dir).filter((f) => re.test(f)); } catch { return []; }
}
function mediaPlugin() {
  const id = 'virtual:media';
  const rid = '\0' + id;
  return {
    name: 'svedectvi-media',
    resolveId(i) { if (i === id) return rid; },
    load(i) {
      if (i !== rid) return;
      const voices = ls('assets/voices', MEDIA.voices);
      const video = ls('assets/video', MEDIA.video);
      const timings = ls('assets/voices', /\.json$/i);
      const hymna = ls('assets/hymna', MEDIA.hymna);
      const klip = ls('public/hymna', /\.mp4$/i); // videoklip hymny (public/hymna/rauko_klip.mp4)
      return `export default ${JSON.stringify({ voices, video, timings, hymna, klip })};`;
    },
    configureServer(server) {
      const re = /assets[\\/](voices|video|hymna)[\\/]/;
      const bump = (f) => {
        if (!re.test(f)) return;
        const m = server.moduleGraph.getModuleById(rid);
        if (m) server.moduleGraph.invalidateModule(m);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(['assets/voices', 'assets/video', 'assets/hymna']);
      server.watcher.on('add', bump);
      server.watcher.on('unlink', bump);
    },
    closeBundle() {
      for (const [dir, re] of [['voices', MEDIA.voices], ['video', MEDIA.video], ['voices', /\.json$/i], ['hymna', MEDIA.hymna], ['proroctvi', MEDIA.proroctvi]]) {
        const src = path.resolve('assets', dir);
        const dst = path.resolve('dist/assets', dir);
        for (const f of ls(src, re)) {
          fs.mkdirSync(dst, { recursive: true });
          fs.copyFileSync(path.join(src, f), path.join(dst, f));
        }
      }
    },
  };
}

// Odkazy v og:image / twitter:image musí být absolutní. Na Vercelu se doplní z adresy nasazení, jinde zůstanou relativní.
function sitePlugin() {
  return {
    name: 'site-url',
    transformIndexHtml(html) {
      const logo = fs.readFileSync('src/assets/draci.svg', 'utf8').trim();
      html = html.replace(/<!--LOGO:(\d+)-->/g, (_, n) => logo.replace('<svg ', `<svg class="logo" width="${n}" height="${n}" role="img" aria-label="Západní draci" focusable="false" `));
      const host = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      return html.replaceAll('%SITE%', host ? host.replace(/\/$/, '') + '/' : '');
    },
  };
}

// Kontrola faktů (scripts/fakta.py) se spouští při každém buildu; porušení invariantů build zastaví.
// Když na stroji není Python, kontrola se přeskočí s varováním (chybí-li, build kvůli tomu nespadne).
function faktaPlugin() {
  return {
    name: 'kontrola-faktu',
    apply: 'build',
    buildStart() {
      for (const py of ['python3', 'python']) {
        const r = spawnSync(py, ['scripts/fakta.py'], { encoding: 'utf8' });
        if (r.error) continue;
        if (r.stdout) console.log(r.stdout.trim());
        if (r.status !== 0) { if (r.stderr) console.error(r.stderr); throw new Error('Kontrola faktů (scripts/fakta.py) našla rozpory, build se zastavuje.'); }
        return;
      }
      console.warn('! Python není k dispozici, kontrola faktů (scripts/fakta.py) se přeskakuje.');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [faktaPlugin(), mediaPlugin(), sitePlugin()],
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
  server: { host: true },
});
