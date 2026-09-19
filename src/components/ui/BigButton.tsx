"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "warm" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-calm-600 text-white border-2 border-calm-700 hover:bg-calm-700 active:bg-calm-800 shadow-soft",
  secondary:
    "bg-white text-calm-800 border-2 border-calm-300 hover:bg-calm-50 active:bg-calm-100 shadow-soft",
  warm: "bg-warm-400 text-warm-900 border-2 border-warm-500 hover:bg-warm-300 active:bg-warm-500 shadow-soft",
  ghost: "bg-transparent text-ink-700 border-2 border-transparent hover:bg-ink-100 active:bg-ink-200",
  danger: "bg-care-600 text-white border-2 border-care-700 hover:bg-care-700 active:bg-care-800 shadow-soft",
};

const sizeClasses: Record<Size, string> = {
  // Every size keeps a comfortable touch target; `xl` is for the senior screens.
  sm: "min-h-11 px-4 text-sm gap-2 rounded-xl font-semibold",
  md: "min-h-12 px-5 text-base gap-2 rounded-2xl font-semibold",
  lg: "min-h-16 px-6 text-xl gap-3 rounded-3xl font-bold",
  xl: "min-h-[5rem] px-8 text-2xl gap-4 rounded-4xl font-bold",
};

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

function classesFor({ variant = "primary", size = "md", fullWidth, className }: CommonProps): string {
  return cn(
    "inline-flex items-center justify-center text-center transition-all duration-150",
    "focus-visible:outline-3 focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-55",
    "active:translate-y-px",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}

type ButtonProps = CommonProps & Omit<ComponentProps<"button">, "className" | "children">;

export function BigButton({ children, icon, iconRight, ...rest }: ButtonProps) {
  const { variant, size, fullWidth, className, ...buttonProps } = rest as ButtonProps;
  return (
    <button
      type="button"
      {...buttonProps}
      className={classesFor({ children, variant, size, fullWidth, className })}
    >
      {icon ? <span aria-hidden="true" className="shrink-0">{icon}</span> : null}
      <span className="min-w-0">{children}</span>
      {iconRight ? <span aria-hidden="true" className="shrink-0">{iconRight}</span> : null}
    </button>
  );
}

type LinkButtonProps = CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children">;

export function BigLinkButton({ children, icon, iconRight, ...rest }: LinkButtonProps) {
  const { variant, size, fullWidth, className, ...linkProps } = rest as LinkButtonProps;
  return (
    <Link {...linkProps} className={classesFor({ children, variant, size, fullWidth, className })}>
      {icon ? <span aria-hidden="true" className="shrink-0">{icon}</span> : null}
      <span className="min-w-0">{children}</span>
      {iconRight ? <span aria-hidden="true" className="shrink-0">{iconRight}</span> : null}
    </Link>
  );
}
