/**
 * The judge's method, in two parts: what it scores and what the score is
 * worth, then the sample accounts. Shared by `/method` and, on a
 * SIX_SCHOOLS build, `/how-it-works`, which merges the method and the
 * rubric into one page (Arthur, 2026-11-06). `sub` sets the headings one
 * level down, where the page puts them under a section of its own;
 * without it the markup is `/method`'s as it was.
 *
 * Every claim here is taken from content/prompts/judge.v2.md or from the
 * code that calls it. There is no claim of validity or accuracy, because
 * none has been established.
 *
 * The scored criteria are three, not four: judge.v2.md lists Fidelity,
 * Rigor and Engagement under "Score in this order of priority", and the
 * response schema adds one composite `score` on top of them.
 */
import { SAMPLE_EXPLANATION } from "@/lib/sample";

export function JudgeMethod({ sub = false }: { sub?: boolean }) {
  const H = sub ? "h3" : "h2";
  // The pause sentence follows the kill switch (Arthur, 2026-11-08: "make
  // it follow the kill switch, so it is only shown when judging is
  // actually paused"). Read here, as /debate and /today read it, for
  // display only: /api/judge owns the switch and decides. Both pages are
  // prerendered, so this is read at build, which matches the switch's own
  // rule: set it and redeploy.
  const judgingPaused = process.env.KILL_SWITCH_JUDGE === "true";
  return (
    <>
      <div className="prose-reading mt-6">
        <p>
          Sophecs asks you to argue a motion from the school of ethics the quiz
          placed you in. An AI model reads your argument together with the
          motion and the written criteria for your school. It sees nothing else
          about you.
        </p>

        <p>
          It scores three things, in this order of weight.{" "}
          <strong className="font-medium">Fidelity</strong> asks whether the
          argument reasons the way that school reasons, using its actual
          commitments, rather than merely arriving at a position the school
          happens to hold. <strong className="font-medium">Rigor</strong> asks
          whether the argument is well built: clear claims, real support, no
          unearned leaps. <strong className="font-medium">Engagement</strong>{" "}
          asks whether it anticipates the strongest objection a rival school
          would raise, and answers it. Those three are reported alongside a
          single combined score out of 100.
        </p>

        <p>
          What that measures is how faithfully a piece of writing applies one
          school of thought. It is not a measure of wisdom, of character, or of
          how good a person you are. A high score means you argued like a
          Stoic, not that you are wise. Nothing on this site assesses you as a
          person.
        </p>
      </div>

      {/* A card, not another section of prose. These are the four
          sentences a reader is most likely to skim past and the ones
          the page exists to make unskippable. */}
      <section className="mt-12 rounded-card border-2 border-rule bg-surface p-6">
        <H className="text-lg font-extrabold tracking-tight text-ink">
          Known limitations
        </H>
        <ul className="mt-4 max-w-[66ch] list-disc space-y-3 pl-5 text-base leading-relaxed text-ink-mid">
          <li>
            A language model can reward writing that is fluent over reasoning
            that is sound.
          </li>
          <li>
            It can be wrong about what a school is committed to, and it can be
            wrong about your argument.
          </li>
          <li>
            {judgingPaused
              ? "Verdict quality is still being checked against real arguments. That is why judging is paused rather than running."
              : "Verdict quality is still being checked against real arguments."}
          </li>
          <li>
            Sophecs is early stage. There is no evidence yet that it improves
            anyone&apos;s reasoning, and no such claim is made.
          </li>
        </ul>
      </section>
    </>
  );
}

/**
 * Linked from the line under the school table on /schools, as `#samples`.
 * Arthur's words (2026-11-08), the same the AI tag opens to
 * (src/lib/sample.ts). A third sentence, on arguing against a sample when
 * no one else is free, follows when sample accounts reply.
 */
export function SampleAccounts() {
  return (
    <section id="samples" className="mt-12 scroll-mt-8">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">Sample accounts</h2>
      <div className="prose-reading mt-4">
        <p>{SAMPLE_EXPLANATION}</p>
      </div>
    </section>
  );
}
