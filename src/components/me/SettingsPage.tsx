import { ClassesSection } from "./ClassesSection";
import { DisplayNameForm } from "./DisplayNameForm";
import { ArgumentVisibilityToggle } from "./ArgumentVisibilityToggle";
import { SignOutButton } from "./SignOutButton";
import { DeleteAccountButton } from "./DeleteAccountButton";
import type { ClassSummary, JoinedClass } from "@/lib/classes";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t-2 border-rule pt-10">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Settings, as a page.
 *
 * Presentational, so the styleguide can show it: the route reads a session
 * and two class queries and cannot be rendered without them.
 *
 * The deletion block keeps its own words, its own two steps and its own
 * order. What it gained is the error tone and a tap target; everything
 * said there is frozen copy.
 */
export function SettingsPage({
  displayName,
  argumentDefaultPublic,
  owned,
  joined,
  prefillCode,
}: {
  displayName: string | null;
  argumentDefaultPublic: boolean;
  owned: ClassSummary[];
  joined: JoinedClass[];
  prefillCode?: string;
}) {
  return (
    <div className="mx-auto max-w-read px-6 py-10">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Settings</h1>

      <Section title="Display name">
        <DisplayNameForm initial={displayName} />
      </Section>

      <Section title="Arguments">
        <ArgumentVisibilityToggle initial={argumentDefaultPublic} />
      </Section>

      <Section title="Classes">
        <ClassesSection owned={owned} joined={joined} prefillCode={prefillCode} />
      </Section>

      <Section title="Your account">
        <SignOutButton />
      </Section>

      {/* Last, behind everything else, and carrying the whole of what
          deletion does before the control that does it. Frozen copy. */}
      <Section title="Delete your account">
        <p className="mb-4 max-w-[50ch] text-sm leading-relaxed text-ink-mid">
          Deleting your account removes your profile, your reading notes
          and the text of any argument you did not publish. Your quiz
          results, scores and verdicts are kept with your name taken off
          them, so a link someone else saved does not go dead. Arguments
          you chose to publish stay up without you attached to them.
        </p>
        <DeleteAccountButton />
      </Section>
    </div>
  );
}
