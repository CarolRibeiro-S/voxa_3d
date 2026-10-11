import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-violeta text-white hover:bg-violeta-escuro shadow-sm",
  secondary: "bg-white text-tinta border border-violeta/20 hover:bg-nevoa",
  ghost: "text-tinta hover:bg-violeta/10",
  dark: "bg-tinta text-white hover:bg-tinta/90",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
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
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta",
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
