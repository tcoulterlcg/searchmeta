import { renderIcon } from "@/lib/icon";

export function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  return params.then(({ size }) => {
    const n = Math.min(1024, Math.max(16, parseInt(size, 10) || 192));
    return renderIcon(n);
  });
}
