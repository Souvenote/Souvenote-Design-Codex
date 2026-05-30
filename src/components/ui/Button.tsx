import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "gold" | "rose" | "ghost";

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  href?: string;
  block?: boolean;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}

const VARIANT_CLASS: Record<Variant, string> = {
  gold: "souv-btn-gold",
  rose: "souv-btn-rose",
  ghost: "souv-btn-ghost",
};

export function Button({
  children,
  variant = "gold",
  href,
  block = false,
  className,
  onClick,
  type = "button",
}: ButtonProps) {
  const classes = cn("souv-btn", VARIANT_CLASS[variant], block && "souv-btn-block", className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} onClick={onClick}>
      {children}
    </button>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("souv-badge", className)}>{children}</span>;
}
