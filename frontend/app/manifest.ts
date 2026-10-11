import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "SoundSight", short_name: "SoundSight",
    description: "Sound awareness, live captions, and type-to-speak.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#16132d", theme_color: "#16132d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
