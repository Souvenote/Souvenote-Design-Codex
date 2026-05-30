"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";

/**
 * Wraps content with a soft gold radial glow that tracks the cursor on hover.
 * Purely decorative — pointer-events stay on the children.
 */
export default function GlowingEffect({
  children,
  className = "",
  color = "rgba(212,175,55,0.18)",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={className}
      style={{
        position: "relative",
        backgroundImage: `radial-gradient(220px circle at var(--glow-x, 50%) var(--glow-y, 0%), ${color}, transparent 60%)`,
      }}
    >
      {children}
    </div>
  );
}
