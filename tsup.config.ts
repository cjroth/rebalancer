import { defineConfig } from 'tsup'

export default defineConfig([
  // Browser entry points (index + next)
  {
    entry: {
      index: 'src/index.ts',
      next: 'src/next.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    platform: 'browser',
    banner: { js: '"use client";' },
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'ink',
      'ink-web',
      'ink-web/next',
      'xterm',
      'zod',
      'fs',
      'path',
      'events',
      /^node:/,
    ],
  },
  // CLI entry point
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    target: 'node18',
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'ink',
      'ink-web',
      'zod',
    ],
  },
])
