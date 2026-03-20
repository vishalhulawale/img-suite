import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';

/**
 * Inline entry CSS into the HTML as <style> blocks.
 * Eliminates the render-blocking CSS request and the HTML → JS → CSS chain.
 */
function inlineCssPlugin(): Plugin {
  return {
    name: 'inline-css',
    enforce: 'post',
    apply: 'build',
    generateBundle(_, bundle) {
      const htmlEntry = Object.values(bundle).find(
        (c) => c.type === 'asset' && c.fileName === 'index.html',
      );
      if (!htmlEntry || htmlEntry.type !== 'asset') return;

      let html =
        typeof htmlEntry.source === 'string'
          ? htmlEntry.source
          : new TextDecoder().decode(htmlEntry.source);

      // Replace each <link rel="stylesheet" href="/assets/…"> with an inline <style>
      html = html.replace(
        /<link rel="stylesheet" crossorigin href="\/([^"]+\.css)"[^>]*>/g,
        (fullMatch, cssPath) => {
          const cssChunk = bundle[cssPath];
          if (cssChunk && cssChunk.type === 'asset') {
            const css =
              typeof cssChunk.source === 'string'
                ? cssChunk.source
                : new TextDecoder().decode(cssChunk.source);
            // Remove the standalone CSS file — it's now inlined
            delete bundle[cssPath];
            return `<style>${css}</style>`;
          }
          return fullMatch;
        },
      );

      htmlEntry.source = html;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    // Inline CSS into HTML to eliminate render-blocking stylesheet requests
    inlineCssPlugin(),
    // Pre-compress assets with gzip + brotli so nginx can serve them directly
    compression({ algorithms: ['gzip', 'brotliCompress'], threshold: 1024 }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, passes: 2 },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime — shared by every route
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/react-router/')
          ) {
            return 'vendor-react';
          }
          // Shared lightweight UI libs (lucide icons are tree-shaken,
          // but the commonly-imported icons should share one chunk)
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          // react-helmet-async — used on every page via SEOHead
          if (id.includes('node_modules/react-helmet-async/')) {
            return 'vendor-react';
          }
          // Everything else (axios, react-dropzone, @hello-pangea/dnd, etc.)
          // is left for Rollup to naturally code-split into the route chunks
          // that actually import them — loaded only when that route is visited.
        },
      },
    },
  },
});
