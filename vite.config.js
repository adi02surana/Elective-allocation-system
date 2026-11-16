import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function ecasApiPlugin() {
  return {
    name: 'ecas-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          try {
            const { handleApiRoute } = await import('./server/routes/apiRouter.js');
            const protocol = req.socket?.encrypted ? 'https' : 'http';
            const parsedUrl = new URL(req.url, `${protocol}://${req.headers.host || 'localhost:5173'}`);

            let body = {};
            if (['POST', 'PUT', 'PATCH'].includes((req.method || '').toUpperCase())) {
              const chunks = [];
              for await (const chunk of req) {
                chunks.push(chunk);
              }
              const raw = Buffer.concat(chunks).toString('utf-8');
              if (raw.trim()) {
                body = JSON.parse(raw);
              }
            }

            return await handleApiRoute(req, res, parsedUrl, body);
          } catch (err) {
            console.error('[Vite ECAS API Middleware Error]:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: err.message }));
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ecasApiPlugin()],
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
