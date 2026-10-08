import type { ReactNode } from "react";
import type { CSSProperties } from "react";

// Eighteen pieces on a ring, the same count and spread as the mockup. Each
// gets its own travel vector and rotation as custom properties, which the
// one `confetti` keyframe in globals.css reads — so the burst is 18 cheap
// elements driven by a single animation rather than 18 keyframe blocks.
// Deterministic, not random: a server-rendered burst that disagreed with
// the client's would hydrate badly.
const PIECES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 120 + (i % 3) * 35;
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance),
    dr: (i % 2 === 0 ? 1 : -1) * (120 + (i % 4) * 60),
    color: ["var(--color-stoic)", "var(--color-utilitarian)", "var(--color-virtue)",
      "var(--color-correct)", "var(--color-step-done)"][i % 5],
    delay: (i % 6) * 20,
  };
});

/**
 * The end-of-step celebration: a burst, a heading, the score tiles, an
 * action.
 *
 * The burst is `aria-hidden` and purely decorative, and it is the first
 * thing the reduced-motion rule kills, so what is left for a reader who has
 * asked for no motion is the heading and the numbers, which is all the
 * information there was.
 */
export function Celebration({
  heading,
  tiles,
  note,
  action,
  secondary,
}: {
  heading: string;
  tiles: ReactNode;
  note?: string;
  action: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center gap-6 py-10 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
        {PIECES.map((p, i) => (
          <span
            key={i}
            className="confetti-piece absolute block h-2.5 w-2.5 rounded-[2px]"
            style={
              {
                background: p.color,
                "--dx": `${p.dx}px`,
                "--dy": `${p.dy}px`,
                "--dr": `${p.dr}deg`,
                animationDelay: `${p.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <h2 className="pop relative text-xl font-extrabold tracking-tight text-ink">{heading}</h2>

      <div className="enter grid w-full max-w-md grid-cols-2 gap-3.5" style={{ animationDelay: "120ms" }}>
        {tiles}
      </div>

      {note && (
        <p className="enter max-w-[48ch] text-sm leading-relaxed text-ink-mid" style={{ animationDelay: "240ms" }}>
          {note}
        </p>
      )}

      <div className="enter flex flex-col items-center gap-4" style={{ animationDelay: "360ms" }}>
        {action}
        {secondary}
      </div>
    </div>
  );
}
