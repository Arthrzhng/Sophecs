"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import type { SchoolId } from "@/lib/types";

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
  school,
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
  /**
   * The school of the reader doing the confirming, where the screen knows
   * it. Omitted on a screen that has no school to speak of.
   */
  school?: SchoolId;
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
        <ChunkyButton tone="paper" className="border-2 border-rule-strong" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </ChunkyButton>
        {/* Coloured for whoever is acting, like every other primary.
            A destructive act is coloured for the act, so error wins even
            when a school is passed. Otherwise it is the reader's school,
            and ink only where they have none: the dialog is school-less,
            not the reader, and the caller knows which. */}
        <ChunkyButton
          tone={destructive ? "error" : school ? "school" : "ink"}
          school={school}
          onClick={onConfirm}
          loading={busy}
          loadingLabel="Working…"
        >
          {confirmLabel}
        </ChunkyButton>
      </div>
    </dialog>
  );
}
