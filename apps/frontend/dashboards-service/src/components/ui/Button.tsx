// apps/frontend/dashboards-service/src/components/ui/Button.tsx
import React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base = "inline-flex items-center justify-center rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
const sizes: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2",
  lg: "text-base px-5 py-2.5",
};
const variants: Record<Variant, string> = {
  primary: "bg-black text-white dark:bg-white dark:text-black hover:opacity-90",
  secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
  ghost: "bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { className = "", variant = "primary", size = "md", ...rest },
  ref
) {
  return <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest} />;
});
