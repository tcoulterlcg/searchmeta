import { renderIcon } from "@/lib/icon";

/** `/icons/512` is the rounded tile; `/icons/512?shape=full` is the full-bleed square for phones. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const n = Math.min(1024, Math.max(16, parseInt(size, 10) || 192));
  return renderIcon(n, new URL(req.url).searchParams.get("shape") === "full" ? "full" : "tile");
}
