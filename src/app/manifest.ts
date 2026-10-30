import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'Racha Fortalaka', short_name: 'FORTALAKA',
    description: 'App oficial do Racha Fortalaka.', lang: 'pt-BR',
    start_url: '/', scope: '/', display: 'standalone', orientation: 'any',
    theme_color: '#171717', background_color: '#fafafa',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
