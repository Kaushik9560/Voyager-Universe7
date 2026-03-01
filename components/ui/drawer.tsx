"use client";

import React, { useEffect, useRef } from "react";

type DrawerSide = "left" | "right";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: DrawerSide;
  ariaLabel: string;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  side,
  ariaLabel,
  returnFocusRef,
  children,
}: DrawerProps) {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  const hiddenTranslate = side === "left" ? "-translate-x-full" : "translate-x-full";
  const anchorSide = side === "left" ? "left-0" : "right-0";

  return (
    <div
      className={`fixed inset-0 z-[70] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className={`absolute inset-0 transition-opacity duration-200 ease-out ${open ? "opacity-100" : "opacity-0"}`}
        style={{ background: "var(--scrim)", backdropFilter: "blur(10px)" }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`absolute top-0 ${anchorSide} h-full w-[86vw] max-w-[420px] border transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : hiddenTranslate
        }`}
        style={{
          borderColor: "var(--glass-border)",
          background:
            "linear-gradient(160deg, color-mix(in oklch, var(--surface-strong) 88%, white 12%), color-mix(in oklch, var(--surface-soft) 80%, white 20%))",
          backdropFilter: "blur(18px)",
          boxShadow: "0 30px 56px oklch(0.14 0.03 240 / 0.22), inset 0 1px 0 oklch(1 0 0 / 0.54)",
        }}
      >
        <div className="h-full overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}
