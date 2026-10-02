import { renderIcon } from "@/lib/icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
// v3. iPhones round the corners themselves, so this one is the full square.
export default function AppleIcon() {
  return renderIcon(180, "full");
}
