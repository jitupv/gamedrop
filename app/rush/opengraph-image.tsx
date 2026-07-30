import { gameOgAlt, gameOgImage, ogImageContentType, ogImageSize } from "@/lib/ogImage";

export const size = ogImageSize;
export const contentType = ogImageContentType;
export const alt = gameOgAlt("rush");

export default function Image() {
  return gameOgImage("rush");
}
