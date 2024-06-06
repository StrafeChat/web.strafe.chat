import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Metadata {
  title: string | null;
  description: string | null;
  themecolor: string | null;
  image: {
    url: string | null,
    width: number,
    height: number,
  };
  video: {
    url: string | null,
    width: number,
    height: number,
  };
  author: {
    name: string,
  };
  url: string;
}

export interface SpotifyEmbed {
  title: string | null;
  type: string | null;
  thumbnail_url: string | null;
  height: number | null;
  width: number | null;
  iframe_url: string | null;
}

export function fetchMetadata(
  url: string,
  callback: (metadata: Metadata | null) => void
): void {
  fetch(`${process.env.NEXT_PUBLIC_METADATA}/embed?url=${url}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok when fetching metadata details.");
      }
      return response.json();
    })
    .then((data) => {

      const imageURL = data["og:image"] || data["twitter:image"] || null;
      const videoURL = data["twitter:player"] || data["og:video:secure_url"] || data["og:video:url"] || null;

      const metadata: Metadata = {
        author: {
          name: data["og:site_name"],
          //  icon_url: data[""]
        },
        title: data["og:title"] || data.title || null,
        description: data["og:description"] || data.description || null,
        themecolor: data["theme-color"] || null,
        image: {
          url: imageURL ? (new URL(imageURL, url).href) : null,
          width: data["og:image:width"] || null,
          height: data["og:image:height"] || null,
        },
        video: {
          url: videoURL ? (new URL(videoURL, url).href) : null,
          width: data["twitter:player:width"] || data["og:video:width"] || null,
          height: data["twitter:player:height"] || data["og:video:height"] || null,
        },
        url: data["og:url"] || url,
      };
      if (metadata.title || metadata.description) {
        callback(metadata);
      } else {
        callback(null);
      }
    })
    .catch((error) => {
      console.error("Error fetching metadata:", error);
      callback(null);
    });
}

export function fetchSpotifyEmbed(
  url: string,
  callback: (metadata: SpotifyEmbed | null) => void
): void {
  fetch(`https://open.spotify.com/oembed?url=${url}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok when fetching Spotify embed.");
      }
      return response.json();
    })
    .then((data) => {

      const spotifyEmbed: SpotifyEmbed = {
        title: data.title || null,
        type: data.type || null,
        thumbnail_url: data.thumbnail_url || null,
        height: data.height || null,
        width: data.width ||null,
        iframe_url: data.iframe_url || null,
      };
      if (spotifyEmbed.iframe_url) {
        callback(spotifyEmbed);
      } else {
        callback(null);
      }
    })
    .catch((error) => {
      console.error("Error fetching Spotify embed:", error);
      callback(null);
    });
}