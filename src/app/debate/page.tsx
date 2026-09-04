export const metadata = { title: "Debate · Sophecs" };

// Topics and micro-lessons are still being written — see docs/decisions.md.
// This stays a plain placeholder rather than shipping empty or fake
// content, same discipline as Phase 1's unfinished lesson modules.
export default function DebatePage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <p className="eyebrow text-ink-soft mb-4">Debate</p>
        <h1 className="font-serif text-2xl font-medium">Still developing.</h1>
        <p className="mt-3 text-ink-mid text-sm max-w-[50ch]">
          The debate arena — topics, arguments, and a judge — is being
          written. Check back soon.
        </p>
      </div>
    </main>
  );
}
