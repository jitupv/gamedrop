import { gameOgAlt, gameOgImage, ogImageContentType, ogImageSize } from "@/lib/ogImage";

export const size = ogImageSize;
export const contentType = ogImageContentType;
export const alt = gameOgAlt("trace");

export default function Image() {
  return gameOgImage("trace");
}
