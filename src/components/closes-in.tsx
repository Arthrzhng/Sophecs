"use client";

import { useEffect, useState } from "react";
import { formatClosesIn } from "@/lib/format";

// Ticks once a minute. Rendered empty on the server and filled after mount,
// so the clock never disagrees between server and client HTML.
export function ClosesIn({ closesAt }: { closesAt: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatClosesIn(closesAt));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [closesAt]);

  return <span className="font-mono">{label ?? "—"}</span>;
}
