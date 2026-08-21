const CACHE_NAME = 'paper-doll-studio-v92d4a2da';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css?v=5cb25082',
  './css/app.css?v=d348ede7',
  './css/base/base.css?v=582bcd34',
  './css/components/buttons.css?v=2192815b',
  './css/components/cards.css?v=f90fb1b6',
  './css/components/dialogs.css?v=8c709962',
  './css/components/toasts.css?v=f236a6dc',
  './css/components/footer.css?v=c27c124b',
  './css/features/header.css?v=4bf96bb6',
  './css/features/designer.css?v=d17b1cb3',
  './css/features/play.css?v=e03bb77c',
  './css/features/paint.css?v=d4825b95',
  './css/responsive/responsive.css?v=2e0ce50b',
  './js/app.js?v=4',
  './js/core/app-store.js',
  './js/core/asset-catalog.js',
  './js/core/asset-registry.js',
  './js/core/coordinate-space.js',
  './js/core/error-boundary.js',
  './js/core/i18n.js',
  './js/core/palette.js',

  './js/core/pointer-controller.js',
  './js/core/state-schema.js',
  './js/core/storage-adapter.js',
  './js/core/svg-loader.js',
  './js/core/text.js',
  './js/domain/animation-clips.js',
  './js/domain/motion-evaluator.js',
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
  './js/services/scene-animation-service.js',
  './js/services/voice-puppetry.js',
  './assets/app-icon.svg',
  './assets/characters/doll-classic-a.svg',
  './assets/characters/doll-classic-b.svg',
  './assets/characters/doll-chibi-a.svg',
  './assets/characters/doll-baby-a.svg',
  './assets/characters/doll-adult-a.svg',
  './assets/characters/doll-elder-a.svg',
  './assets/characters/face/eyes-classic.svg',
  './assets/characters/face/eyes-round.svg',
  './assets/characters/face/eyes-sparkle.svg',
  './assets/characters/face/eyes-calm.svg',
  './assets/characters/face/eyes-curious.svg',
  './assets/characters/face/brows-soft.svg',
  './assets/characters/face/brows-arched.svg',
  './assets/characters/face/brows-bold.svg',
  './assets/characters/face/brows-expressive.svg',
  './assets/characters/face/nose-dot.svg',
  './assets/characters/face/nose-button.svg',
  './assets/characters/face/nose-soft-curve.svg',
  './assets/characters/face/mouth-gentle-smile.svg',
  './assets/characters/face/mouth-open-smile.svg',
  './assets/characters/face/mouth-neutral.svg',
  './assets/characters/face/mouth-playful.svg',
  './assets/characters/face/mouth-smirk.svg',
  './assets/characters/face/detail-blush.svg',
  './assets/characters/face/detail-freckles.svg',
  './assets/backgrounds/atelier.svg',
  './assets/backgrounds/bedroom.svg',
  './assets/backgrounds/park.svg',
  './assets/backgrounds/beach.svg',
  './assets/backgrounds/cafe.svg',
  './assets/backgrounds/forest.svg',
  './assets/backgrounds/library.svg',
  './assets/backgrounds/moonlit-meadow.svg',
  './assets/backgrounds/snowy-village.svg',
  './assets/backgrounds/city-sunset.svg',
  './assets/backgrounds/candy-land.svg',
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
  './assets/clothing/hair/baby-curl.svg',
  './assets/clothing/hair/silver-waves.svg',
  './assets/clothing/hair/short-slick.svg',
  './assets/clothing/hair/bob-child.svg',
  './assets/clothing/hair/curls-child.svg',
  './assets/clothing/hair/puffs-baby.svg',
  './assets/clothing/hair/bun-baby.svg',
  './assets/clothing/shoes/sandals.svg',
  './assets/clothing/shoes/sneakers.svg',
  './assets/clothing/shoes/boots.svg',
  './assets/clothing/shoes/loafers.svg',
  './assets/clothing/shoes/ballet.svg',
  './assets/clothing/shoes/rainboots.svg',
  './assets/clothing/shoes/booties-baby.svg',
  './assets/clothing/shoes/oxfords-classic.svg',
  './assets/clothing/shoes/sneakers-child.svg',
  './assets/clothing/shoes/rainboots-child.svg',
  './assets/clothing/shoes/sandals-baby.svg',
  './assets/clothing/shoes/sneakers-baby.svg',
  './assets/clothing/bottoms/skirt.svg',
  './assets/clothing/bottoms/jeans.svg',
  './assets/clothing/bottoms/shorts.svg',
  './assets/clothing/bottoms/overalls.svg',
  './assets/clothing/bottoms/pleated-skirt.svg',
  './assets/clothing/bottoms/culottes.svg',
  './assets/clothing/bottoms/cargo.svg',
  './assets/clothing/bottoms/trousers-classic.svg',
  './assets/clothing/bottoms/slacks-adult.svg',
  './assets/clothing/bottoms/shorts-child.svg',
  './assets/clothing/bottoms/jeans-child.svg',
  './assets/clothing/bottoms/bloomers-baby.svg',
  './assets/clothing/bottoms/leggings-baby.svg',
  './assets/clothing/dresses/sundress.svg',
  './assets/clothing/dresses/party-dress.svg',
  './assets/clothing/dresses/pinafore.svg',
  './assets/clothing/dresses/ballgown.svg',
  './assets/clothing/dresses/overall.svg',
  './assets/clothing/dresses/romper-baby.svg',
  './assets/clothing/dresses/play-dress-child.svg',
  './assets/clothing/dresses/rain-dress-child.svg',
  './assets/clothing/dresses/sun-dress-baby.svg',
  './assets/clothing/dresses/party-dress-baby.svg',
  './assets/clothing/dresses/wrap-adult.svg',
  './assets/clothing/dresses/suit-adult.svg',
  './assets/clothing/dresses/knit-elder.svg',
  './assets/clothing/dresses/apron-elder.svg',
  './assets/clothing/tops/blouse.svg',
  './assets/clothing/tops/tshirt.svg',
  './assets/clothing/tops/hoodie.svg',
  './assets/clothing/tops/cardigan.svg',
  './assets/clothing/tops/crop-jacket.svg',
  './assets/clothing/tops/sweater.svg',
  './assets/clothing/tops/sailor.svg',
  './assets/clothing/tops/raincoat.svg',
  './assets/clothing/tops/vest.svg',
  './assets/clothing/tops/cardigan-classic.svg',
  './assets/clothing/tops/coat-adult.svg',
  './assets/clothing/tops/tshirt-child.svg',
  './assets/clothing/tops/hoodie-child.svg',
  './assets/clothing/tops/cardigan-baby.svg',
  './assets/clothing/tops/tee-baby.svg',
  './assets/clothing/accessories/glasses.svg',
  './assets/clothing/accessories/bow.svg',
  './assets/clothing/accessories/hat.svg',
  './assets/clothing/accessories/beret.svg',
  './assets/clothing/accessories/crown.svg',
  './assets/clothing/accessories/headphones.svg',
  './assets/clothing/accessories/cat-ears.svg',
  './assets/clothing/accessories/ribbon.svg',
  './assets/clothing/accessories/hairclip.svg',
  './assets/clothing/accessories/flower.svg',
  './assets/clothing/accessories/bib-baby.svg',
  './assets/clothing/accessories/pacifier-baby.svg',
  './assets/clothing/accessories/shawl-elder.svg',
  './assets/clothing/accessories/spectacles-elder.svg',
  './assets/clothing/accessories/cap-child.svg',
  './assets/clothing/accessories/backpack-child.svg',
  './assets/clothing/accessories/bonnet-baby.svg',
  './assets/clothing/accessories/rattle-baby.svg'
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
