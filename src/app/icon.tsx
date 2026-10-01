import { renderIcon } from "@/lib/icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
// v2: converge mark. Changing this file changes the icon's address, so browsers drop the old cached icon.
export default function Icon() {
  return renderIcon(32);
}
