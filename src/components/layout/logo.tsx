import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "dark" | "light";
  className?: string;
}

// Provisório: trocar pela imagem final.
export function Logo({ variant = "dark", className }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex select-none text-2xl font-extrabold uppercase tracking-[0.2em]",
        variant === "light" ? "text-white" : "text-tinta",
        className,
      )}
      aria-label="Voxa 3D"
    >
      VOX
      <span className="relative">
        A
        <span className="absolute -right-3 -top-1 text-[0.5em] font-extrabold leading-none tracking-normal text-violeta">
          3D
        </span>
      </span>
    </span>
  );
}
