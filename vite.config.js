import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
export default defineConfig({
  plugins: [{ name:'training-progress', configureServer(server) {
    server.middlewares.use('/api/training-progress', (_req,res) => {
      const read=(path)=>existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({ training:read('reports/training.json'), manifest:read('data/processed/manifest.json') }));
    });
  } }],
  server: { port: 5173, strictPort: true, proxy: {
    '/api': 'http://127.0.0.1:8765',
    '/ws': { target: 'ws://127.0.0.1:8765', ws: true },
  } },
});
