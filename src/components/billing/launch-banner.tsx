import { Zap } from "lucide-react";
import type { LaunchLevel } from "@/lib/billing/launch-types";
import { cn } from "@/lib/utils";

// Destaque de urgência por nível, sem números e sem prazo (a promoção não tem data final).
const TEXTS: Record<Exclude<LaunchLevel, "hidden">, { title: string; subtitle: string }> = {
  open: {
    title: "Preço de lançamento com vagas limitadas",
    subtitle: "Garanta o seu antes que as vagas acabem.",
  },
  last: {
    title: "Últimas vagas com preço de lançamento",
    subtitle: "Não perca tempo: quando acabarem, os preços voltam ao normal.",
  },
  soldout: {
    title: "As vagas de lançamento esgotaram",
    subtitle: "Você ainda pode assinar pelos preços normais.",
  },
};

export function LaunchBanner({ level }: { level: LaunchLevel }) {
  if (level === "hidden") return null;
  const text = TEXTS[level];
  const soldOut = level === "soldout";

  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4",
        soldOut
          ? "border-violeta/10 bg-nevoa text-tinta"
          : "bg-tinta text-white",
        level === "last" ? "border-limao" : !soldOut && "border-tinta",
      )}
    >
      {/* Pulso sutil só no ícone, desligado para quem prefere menos movimento. */}
      <Zap
        size={22}
        className={cn(
          "mt-0.5 shrink-0",
          soldOut ? "text-violeta" : "text-limao motion-safe:animate-pulse",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-extrabold leading-tight">
          {text.title}
          {level === "last" && (
            <span className="rounded-full bg-limao px-2 py-0.5 text-xs font-bold text-tinta">
              Últimas vagas
            </span>
          )}
        </p>
        <p className={cn("mt-1 text-sm leading-snug", soldOut ? "text-tinta/80" : "text-nevoa")}>
          {text.subtitle}
        </p>
      </div>
    </div>
  );
}
