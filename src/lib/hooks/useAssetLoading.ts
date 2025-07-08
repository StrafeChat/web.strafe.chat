import { createSignal, onCleanup, createEffect } from "solid-js";

export const useAssetLoading = () => {
  const [assetsLoaded, setAssetsLoaded] = createSignal(false);
  const [loadingStates, setLoadingStates] = createSignal({
    images: false,
    fonts: false,
    stylesheets: false,
    scripts: false,
    domReady: false
  });

  // Check if all loading states are complete
  createEffect(() => {
    const states = loadingStates();
    const allLoaded = Object.values(states).every(state => state === true);
    if (allLoaded && !assetsLoaded()) {
      // Add a small delay to ensure everything is properly rendered
      setTimeout(() => {
        setAssetsLoaded(true);
      }, 100);
    }
  });

  // Track images - only truly critical static images, exclude dynamic content
  const trackImages = () => {
    // Only track images that are critical for initial UI rendering
    // Exclude dynamic images like avatars, profile pictures, etc.
    const images = document.querySelectorAll("img");
    const criticalImages = Array.from(images).filter(img => {
      // Only track images that:
      // 1. Have a src attribute
      // 2. Are not dynamic/user-generated content (avatars, profile pics)
      // 3. Are likely static assets (logos, icons, etc.)
      if (!img.src) return false;
      
      // Skip images that are likely dynamic content
      const isDynamic = img.src.includes('/avatar/') || 
                       img.src.includes('/profile/') || 
                       img.src.includes('/user/') ||
                       img.classList.contains('avatar') ||
                       img.classList.contains('profile-image') ||
                       img.classList.contains('user-image');
      
      if (isDynamic) return false;
      
      // Only track if already loaded or has started loading
      return img.complete || img.naturalWidth > 0 || img.naturalHeight > 0;
    });

    console.log(`[AssetLoading] Found ${criticalImages.length} critical images to track`);

    if (criticalImages.length === 0) {
      console.log('[AssetLoading] No critical images found, marking images as loaded');
      setLoadingStates(prev => ({ ...prev, images: true }));
      return;
    }

    let loadedCount = 0;
    const checkImagesLoaded = () => {
      if (loadedCount >= criticalImages.length) {
        console.log(`[AssetLoading] All ${criticalImages.length} critical images loaded`);
        setLoadingStates(prev => ({ ...prev, images: true }));
      }
    };

    criticalImages.forEach((img, index) => {
      if (img.complete && img.naturalHeight !== 0) {
        loadedCount++;
        console.log(`[AssetLoading] Image ${index + 1}/${criticalImages.length} already loaded:`, img.src);
      } else {
        const onLoad = () => {
          loadedCount++;
          console.log(`[AssetLoading] Image ${index + 1}/${criticalImages.length} loaded:`, img.src);
          checkImagesLoaded();
          img.removeEventListener("load", onLoad);
          img.removeEventListener("error", onError);
        };
        const onError = () => {
          loadedCount++; // Count errors as "loaded" to prevent hanging
          console.log(`[AssetLoading] Image ${index + 1}/${criticalImages.length} failed to load:`, img.src);
          checkImagesLoaded();
          img.removeEventListener("load", onLoad);
          img.removeEventListener("error", onError);
        };
        img.addEventListener("load", onLoad);
        img.addEventListener("error", onError);
      }
    });
    checkImagesLoaded();
  };

  // Track fonts
  const trackFonts = () => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        setLoadingStates(prev => ({ ...prev, fonts: true }));
      }).catch(() => {
        // If font loading fails, still mark as complete
        setLoadingStates(prev => ({ ...prev, fonts: true }));
      });
    } else {
      // Fallback for browsers without FontFaceSet API
      setTimeout(() => {
        setLoadingStates(prev => ({ ...prev, fonts: true }));
      }, 1000);
    }
  };

  // Track stylesheets
  const trackStylesheets = () => {
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    if (stylesheets.length === 0) {
      setLoadingStates(prev => ({ ...prev, stylesheets: true }));
      return;
    }

    let loadedCount = 0;
    const checkStylesheetsLoaded = () => {
      if (loadedCount >= stylesheets.length) {
        setLoadingStates(prev => ({ ...prev, stylesheets: true }));
      }
    };

    stylesheets.forEach((link: any) => {
      if (link.sheet) {
        loadedCount++;
      } else {
        const onLoad = () => {
          loadedCount++;
          checkStylesheetsLoaded();
          link.removeEventListener("load", onLoad);
          link.removeEventListener("error", onError);
        };
        const onError = () => {
          loadedCount++; // Count errors as "loaded"
          checkStylesheetsLoaded();
          link.removeEventListener("load", onLoad);
          link.removeEventListener("error", onError);
        };
        link.addEventListener("load", onLoad);
        link.addEventListener("error", onError);
      }
    });
    checkStylesheetsLoaded();
  };

  // Track scripts
  const trackScripts = () => {
    const scripts = document.querySelectorAll('script[src]');
    if (scripts.length === 0) {
      setLoadingStates(prev => ({ ...prev, scripts: true }));
      return;
    }

    let loadedCount = 0;
    const checkScriptsLoaded = () => {
      if (loadedCount >= scripts.length) {
        setLoadingStates(prev => ({ ...prev, scripts: true }));
      }
    };

    scripts.forEach((script: any) => {
      if (script.readyState === 'complete' || script.readyState === 'loaded') {
        loadedCount++;
      } else {
        const onLoad = () => {
          loadedCount++;
          checkScriptsLoaded();
          script.removeEventListener("load", onLoad);
          script.removeEventListener("error", onError);
        };
        const onError = () => {
          loadedCount++; // Count errors as "loaded"
          checkScriptsLoaded();
          script.removeEventListener("load", onLoad);
          script.removeEventListener("error", onError);
        };
        script.addEventListener("load", onLoad);
        script.addEventListener("error", onError);
      }
    });
    checkScriptsLoaded();
  };

  // Track DOM ready state
  const trackDOMReady = () => {
    if (document.readyState === 'complete') {
      setLoadingStates(prev => ({ ...prev, domReady: true }));
    } else {
      const onReady = () => {
        setLoadingStates(prev => ({ ...prev, domReady: true }));
        document.removeEventListener('readystatechange', onReady);
      };
      document.addEventListener('readystatechange', onReady);
    }
  };

  // Initialize all tracking
  const initializeTracking = () => {
    trackDOMReady();
    trackFonts();
    trackStylesheets();
    trackScripts();
    
    // Track images with a slight delay to ensure DOM is ready
    // Use shorter timeout to prevent blocking on dynamic images
    setTimeout(() => {
      trackImages();
      // Aggressive fallback - if images aren't loaded quickly, assume they're dynamic
      setTimeout(() => {
        const states = loadingStates();
        if (!states.images) {
          console.log('[AssetLoading] Image loading timeout reached, assuming dynamic content - marking as complete');
          setLoadingStates(prev => ({ ...prev, images: true }));
        }
      }, 500); // Reduced from 1000ms to 500ms
    }, 50);
  };

  // Start tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTracking);
  } else {
    initializeTracking();
  }

  onCleanup(() => {
    document.removeEventListener('DOMContentLoaded', initializeTracking);
  });

  return assetsLoaded;
};
