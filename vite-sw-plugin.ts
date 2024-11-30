import { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

export default function serviceWorkerPlugin(): Plugin {
  return {
    name: 'service-worker',
    async buildEnd() {
      // Copy service worker to dist
      const swSource = path.resolve(__dirname, 'src/service-worker.ts');
      const swDest = path.resolve(__dirname, 'dist/service-worker.js');

      // Ensure dist directory exists
      if (!fs.existsSync(path.dirname(swDest))) {
        fs.mkdirSync(path.dirname(swDest), { recursive: true });
      }

      // Copy and transform service worker
      fs.copyFileSync(swSource, swDest);
    },
    configureServer(server) {
      // Serve service worker in development
      server.middlewares.use((req, res, next) => {
        if (req.url === '/service-worker.js') {
          res.setHeader('Content-Type', 'application/javascript');
          fs.createReadStream(path.resolve(__dirname, 'src/service-worker.ts')).pipe(res);
        } else {
          next();
        }
      });
    },
  };
}
