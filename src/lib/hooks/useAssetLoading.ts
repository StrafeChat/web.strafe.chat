import { createSignal, onCleanup } from "solid-js";

export const useAssetLoading = () => {
  const [assetsLoaded, setAssetsLoaded] = createSignal(false);

  const handleLoad = () => {
    setAssetsLoaded(true);
  };

  // Track images
  const images = document.querySelectorAll("img");
  let loadedCount = 0;

  const checkAllLoaded = () => {
    if (loadedCount === images.length) {
      setAssetsLoaded(true);
    }
  };

  images.forEach((img) => {
    if (img.complete) {
      loadedCount++;
      checkAllLoaded();
    } else {
      img.addEventListener("load", () => {
        loadedCount++;
        checkAllLoaded();
      });
    }
  });

  // Track other assets
  window.addEventListener("load", handleLoad);

  onCleanup(() => {
    window.removeEventListener("load", handleLoad);
  });

  return assetsLoaded;
};
