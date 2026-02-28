import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { defineConfig, type Plugin } from 'vite'

/** Receives POST /diag from browser JS and logs to server console + diag.log.
 *  Enable with DIAG=1, e.g. `DIAG=1 bun run dev`.
 *  Client side: `fetch('/diag', { method: 'POST', body: msg })` */
function diagPlugin(): Plugin {
  const enabled = process.env['DIAG'] === '1'
  const logFile = path.resolve(__dirname, 'diag.log')
  return {
    name: 'vite-plugin-diag',
    configureServer(server) {
      if (!enabled) return
      fs.writeFileSync(logFile, '')
      server.middlewares.use('/diag', (req, res) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (c: Buffer) => { body += c.toString() })
          req.on('end', () => {
            fs.appendFileSync(logFile, body + '\n')
            console.log('[DIAG]', body)
            res.writeHead(200)
            res.end('ok')
          })
        } else {
          res.writeHead(200)
          res.end('ok')
        }
      })
    },
  }
}

export default defineConfig(async () => {
  const { inkWebPlugin } = await import('ink-web/vite')
  const inkWebSrc = path.resolve(__dirname, 'node_modules/ink-web/src')

  return {
    plugins: [react(), inkWebPlugin(), diagPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'ink-web': path.resolve(inkWebSrc, 'index.ts'),
        path: 'path-browserify',
      },
      dedupe: ['react', 'react-dom', 'react-reconciler', 'ink'],
    },
    build: {
      target: 'esnext',
      outDir: path.resolve(__dirname, 'dist'),
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    server: {
      port: 1420,
    },
  }
})
