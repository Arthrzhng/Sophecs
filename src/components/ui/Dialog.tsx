"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";

// Built on <dialog>, not a div with a portal. The browser gives us the
// focus trap, the Escape handler, the inert background and the top-layer
// stacking for free — all of which are the parts a hand-rolled modal gets
// wrong, and the reason a headless dependency is usually reached for here.
//
// One of the two places in the product allowed a shadow, because it
// genuinely floats and can be dismissed.
export function Dialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Escape fires `cancel`; the parent owns `open`, so it has to be told.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancelEvent = (e: Event) => {
      e.preventDefault();
      onCancel();
    };
    el.addEventListener("cancel", onCancelEvent);
    return () => el.removeEventListener("cancel", onCancelEvent);
  }, [onCancel]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
      className="max-w-narrow border border-rule bg-paper p-6 text-ink shadow-overlay backdrop:bg-ink/25 open:animate-none"
    >
      <h2 id="dialog-title" className="font-serif text-lg font-medium">
        {title}
      </h2>
      {description && (
        <p id="dialog-description" className="mt-3 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
          {description}
        </p>
      )}
      {children}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          loading={busy}
          loadingLabel="Working…"
          className={destructive ? "border-error bg-error hover:border-error hover:bg-error" : ""}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
