"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <ChunkyButton tone="paper" onClick={signOut} className="border-2 border-rule-strong">
      Sign out
    </ChunkyButton>
  );
}
