import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex-1 flex items-center">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <p className="eyebrow text-ink-soft mb-6">Nine questions, no login</p>
        <h1 className="font-serif text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.15] tracking-tight max-w-[18ch]">
          When an algorithm decides for you, which philosopher would back you up?
        </h1>
        <p className="mt-6 text-lg text-ink-mid leading-relaxed max-w-[52ch]">
          A wallet with cash on the street. An AI that could finish your
          assignment undetected. A self-driving car that has to choose.
          Nine real scenarios, three schools of ethics, no answer that&apos;s
          obviously correct.
        </p>
        <div className="mt-10">
          <Link
            href="/quiz"
            className="inline-block bg-ink text-surface rounded-md px-6 py-3 text-base font-medium hover:opacity-85 transition-opacity"
          >
            Take the quiz
          </Link>
        </div>
        <p className="mt-6 font-mono text-xs text-ink-soft">
          About 80 seconds. Nothing saved unless you share it.
        </p>
      </div>
    </main>
  );
}
