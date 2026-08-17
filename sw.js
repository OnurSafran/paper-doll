const CACHE_NAME = 'paper-doll-studio-v16';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/app.css',
  './js/app.js?v=4',
  './js/core/app-store.js',
  './js/core/asset-catalog.js',
  './js/core/asset-registry.js',
  './js/core/coordinate-space.js',
  './js/core/error-boundary.js',
  './js/core/palette.js',
  './js/core/pointer-controller.js',
  './js/core/state-schema.js',
  './js/core/storage-adapter.js',
  './js/core/svg-loader.js',
  './js/core/text.js',
  './js/domain/outfit-rules.js',
  './js/domain/scene-rules.js',
  './js/domain/scene-templates.js',
  './js/domain/vocabulary.js',
  './js/features/designer/designer-view.js',
  './js/features/paint/paint-raster.js',
  './js/features/paint/paint-guides.js',
  './js/features/paint/paint-session.js',
  './js/features/paint/paint-view.js',
  './js/features/play/play-view.js',
  './js/features/play/scene-outline-view.js',
  './js/features/scene-book/scene-book-view.js',
  './js/services/custom-art-repository.js',
  './js/services/export-service.js',
  './js/services/project-portability.js',
  './js/services/project-repository.js',
  './js/services/voice-puppetry.js',
  './assets/app-icon.svg',
  './assets/characters/doll-classic-a.svg',
  './assets/characters/doll-classic-b.svg',
  './assets/characters/doll-chibi-a.svg',
  './assets/backgrounds/atelier.svg',
  './assets/backgrounds/bedroom.svg',
  './assets/backgrounds/park.svg',
  './assets/backgrounds/beach.svg',
  './assets/backgrounds/cafe.svg',
  './assets/backgrounds/forest.svg',
  './assets/backgrounds/library.svg',
  './assets/props/chair.svg',
  './assets/props/table.svg',
  './assets/props/lamp.svg',
  './assets/props/plant.svg',
  './assets/props/rug.svg',
  './assets/props/tea-set.svg',
  './assets/props/easel.svg',
  './assets/props/bookshelf.svg',
  './assets/props/cat.svg',
  './assets/props/picnic-basket.svg',
  './assets/props/umbrella.svg',
  './assets/props/balloons.svg',
  './assets/props/cake.svg',
  './assets/props/guitar.svg',
  './assets/props/painting.svg',
  './assets/props/bench.svg',
  './assets/props/bicycle.svg',
  './assets/props/kite.svg',
  './assets/props/camera.svg',
  './assets/props/flower-pot.svg',
  './assets/props/mailbox.svg',
  './assets/props/picnic-blanket.svg',
  './assets/clothing/hair/ponytail.svg',
  './assets/clothing/hair/long.svg',
  './assets/clothing/hair/short.svg',
  './assets/clothing/hair/twintails.svg',
  './assets/clothing/hair/curly.svg',
  './assets/clothing/hair/braids.svg',
  './assets/clothing/hair/bun.svg',
  './assets/clothing/hair/wavy-bob.svg',
  './assets/clothing/shoes/sandals.svg',
  './assets/clothing/shoes/sneakers.svg',
  './assets/clothing/shoes/boots.svg',
  './assets/clothing/shoes/loafers.svg',
  './assets/clothing/shoes/ballet.svg',
  './assets/clothing/shoes/rainboots.svg',
  './assets/clothing/bottoms/skirt.svg',
  './assets/clothing/bottoms/jeans.svg',
  './assets/clothing/bottoms/shorts.svg',
  './assets/clothing/bottoms/overalls.svg',
  './assets/clothing/bottoms/pleated-skirt.svg',
  './assets/clothing/bottoms/culottes.svg',
  './assets/clothing/bottoms/cargo.svg',
  './assets/clothing/dresses/sundress.svg',
  './assets/clothing/dresses/party-dress.svg',
  './assets/clothing/dresses/pinafore.svg',
  './assets/clothing/dresses/ballgown.svg',
  './assets/clothing/dresses/overall.svg',
  './assets/clothing/tops/blouse.svg',
  './assets/clothing/tops/tshirt.svg',
  './assets/clothing/tops/hoodie.svg',
  './assets/clothing/tops/cardigan.svg',
  './assets/clothing/tops/crop-jacket.svg',
  './assets/clothing/tops/sweater.svg',
  './assets/clothing/tops/sailor.svg',
  './assets/clothing/tops/raincoat.svg',
  './assets/clothing/tops/vest.svg',
  './assets/clothing/accessories/glasses.svg',
  './assets/clothing/accessories/bow.svg',
  './assets/clothing/accessories/hat.svg',
  './assets/clothing/accessories/beret.svg',
  './assets/clothing/accessories/crown.svg',
  './assets/clothing/accessories/headphones.svg',
  './assets/clothing/accessories/cat-ears.svg',
  './assets/clothing/accessories/ribbon.svg',
  './assets/clothing/accessories/hairclip.svg',
  './assets/clothing/accessories/flower.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isCodeOrDoc = event.request.mode === 'navigate' ||
                      url.pathname.endsWith('.js') ||
                      url.pathname.endsWith('.css') ||
                      url.pathname.endsWith('.html');

  if (isCodeOrDoc) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('Offline resource unavailable')))))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('Offline resource unavailable'))))
  );
});
