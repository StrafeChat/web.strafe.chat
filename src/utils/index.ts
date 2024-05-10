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
  fetch(`https://jan.revolt.chat/embed?url=${url}`)
    .then(response => {
      const body: any = response.body;
      console.log(body)
      const metadata: Metadata = {
        title: body?.title || null,
        description: body?.description || null,
        image: body?.image.url || null,
      };
      if (metadata.title || metadata.description || metadata.image) { callback(metadata); } else callback(null);
    })
    .catch(error => {
      callback(null);
  });
}


