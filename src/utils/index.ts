import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface Metadata {
  title: string | null;
  description: string | null;
  image: string | null;
}

export function fetchMetadata(url: string, callback: (metadata: Metadata | null) => void): void {
  fetch(url, { method: 'HEAD' })
    .then(response => {
      const headers = response.headers;
      const metadata: Metadata = {
        title: headers.get('x-metadata-title') || null,
        description: headers.get('x-metadata-description') || null,
        image: headers.get('x-metadata-image') || null,
      };
      if (metadata.title || metadata.description || metadata.image) { callback(metadata); } else callback(null);
    })
    .catch(error => {
      callback(null);
  });
}


