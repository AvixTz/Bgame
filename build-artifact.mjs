// Builds a single self-contained HTML page (JS + CSS inlined) for sandboxed hosting.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'dist-single';
await build({
  logLevel: 'warn',
  base: './',
  plugins: [react()],
  build: { outDir: out, emptyOutDir: true, chunkSizeWarningLimit: 5000, rollupOptions: { output: { inlineDynamicImports: true } } },
});
const assets = readdirSync(`${out}/assets`);
const js = readFileSync(`${out}/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(`${out}/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const html = `<title>Bgame אי המוח</title>
<meta name="theme-color" content="#FFF3D6">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;800&family=Suez+One&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root" dir="rtl" lang="he"></div>
<script type="module">${js}</script>
`;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/bgame.html`, html);
console.log(`${out}/bgame.html`, (html.length / 1024).toFixed(0), 'KB');
