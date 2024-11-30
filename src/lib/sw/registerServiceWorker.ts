export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[ServiceWorker] Service workers are not supported');
    return null;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none'
    });

    // Log registration status
    if (registration.installing) {
      console.log('[ServiceWorker] Installing');
    } else if (registration.waiting) {
      console.log('[ServiceWorker] Installed');
    } else if (registration.active) {
      console.log('[ServiceWorker] Active');
    }

    // Listen for state changes
    registration.addEventListener('statechange', (e: Event) => {
      const target = e.target as ServiceWorker;
      console.log('[ServiceWorker] State changed:', target?.state);
    });

    return registration;
  } catch (error) {
    console.error('[ServiceWorker] Registration failed:', error);
    return null;
  }
}
