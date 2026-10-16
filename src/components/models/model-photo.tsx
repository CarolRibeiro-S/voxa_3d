import { Box } from "lucide-react";
import { cn } from "@/lib/utils";

// Foto do modelo com proporção fixa (não pula o layout). Sem foto, mostra o ícone Box.
// A URL é sempre assinada no servidor; nunca existe URL pública do bucket.
export function ModelPhoto({
  url,
  name,
  className,
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square shrink-0 overflow-hidden rounded-xl bg-nevoa text-violeta/40",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center" aria-hidden="true">
          <Box className="size-1/2" />
        </span>
      )}
    </div>
  );
}
