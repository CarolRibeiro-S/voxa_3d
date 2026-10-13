import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-violeta text-white hover:bg-violeta-escuro shadow-sm",
  secondary: "bg-white text-tinta border border-violeta/20 hover:bg-nevoa",
  ghost: "text-tinta hover:bg-violeta/10",
  dark: "bg-tinta text-white hover:bg-tinta/90",
} as const;

// Botão com texto nunca tem altura fixa: min-h-11 (44px) no celular, min-h-10 no desktop, com
// padding vertical. O texto pode crescer para uma segunda linha em vez de ser cortado.
const sizes = {
  sm: "min-h-11 px-3 py-2 text-sm md:min-h-10",
  md: "min-h-11 px-5 py-2 text-sm md:min-h-10",
  lg: "min-h-12 px-6 py-2.5 text-base",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const buttonClasses = ({
  variant = "primary",
  size = "md",
}: Pick<ButtonProps, "variant" | "size"> = {}) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl text-center font-semibold leading-tight text-balance transition-colors disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonClasses({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title" | "children"> {
  // Texto obrigatório: vira aria-label e title.
  label: string;
  variant?: keyof typeof variants;
  children: ReactNode;
}

// Botão só com ícone: sempre 44x44px, com aria-label e title.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className, variant = "ghost", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        buttonClasses({ variant, size: "sm" }),
        "size-11 min-w-11 shrink-0 p-0",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
