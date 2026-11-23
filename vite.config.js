import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Svědectví: audio a video dodá zadavatel do assets/voices/<id>.mp3 a assets/video/<id>.mp4.
// Plugin z nich udělá manifest (virtual:media), aby web věděl, co existuje, a při buildu je zkopíruje do dist/.
const MEDIA = { voices: /\.(mp3|m4a|ogg|wav)$/i, video: /\.(mp4|webm)$/i, hymna: /\.(mp3|mp4|webm|json)$/i };
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
      return `export default ${JSON.stringify({ voices, video, timings, hymna })};`;
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
      for (const [dir, re] of [['voices', MEDIA.voices], ['video', MEDIA.video], ['voices', /\.json$/i], ['hymna', MEDIA.hymna]]) {
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

export default defineConfig({
  base: './',
  plugins: [mediaPlugin()],
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
  server: { host: true },
});
