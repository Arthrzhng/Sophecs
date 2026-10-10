"use client";

import { useState } from "react";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";
import { Dialog } from "@/components/ui/Dialog";
import { Toast, useToast } from "@/components/ui/Toast";

// The interactive half of the styleguide. Everything that needs state lives
// here so the page itself stays a server component.
export function InteractiveSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [toast, showToast, clearToast] = useToast();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <ChunkyButton tone="ink" onClick={() => setDialogOpen(true)}>
          Open a dialog
        </ChunkyButton>
        <ChunkyButton tone="paper" className="border-2 border-rule-strong" onClick={() => setDestructiveOpen(true)}>
          Open a destructive dialog
        </ChunkyButton>
        <ChunkyButton tone="paper" className="border-2 border-rule-strong" onClick={() => showToast("Copied.")}>
          Fire a toast
        </ChunkyButton>
      </div>

      <Dialog
        open={dialogOpen}
        title="Submit this argument?"
        description="It goes to the judge now. You get one verdict and one revision. This motion locks for seven days afterwards."
        confirmLabel="Submit argument"
        school="stoicism"
        onConfirm={() => setDialogOpen(false)}
        onCancel={() => setDialogOpen(false)}
      />

      <Dialog
        open={destructiveOpen}
        destructive
        title="Delete your account?"
        description="Your profile and your reading notes go. Arguments you published stay up without your name on them. This cannot be undone."
        confirmLabel="Delete account"
        onConfirm={() => setDestructiveOpen(false)}
        onCancel={() => setDestructiveOpen(false)}
      />

      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
