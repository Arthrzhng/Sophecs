import type { ReactNode } from "react";
import { shade } from "./chunky";

/**
 * A surface with the same solid bottom edge as the buttons.
 *
 * `raised` is for a card that carries its own colour and sits proud of the
 * page (the week's case). `flat` is the ordinary bordered card, which has no
 * edge: in the mockups only the coloured surfaces are raised, and giving
 * every card a shadow would flatten the hierarchy the edge exists to create.
 */
export function ChunkyCard({
  raised = false,
  shadeColor = "var(--color-rule-strong)",
  background,
  className = "",
  children,
  ...rest
}: {
  raised?: boolean;
  shadeColor?: string;
  background?: string;
  className?: string;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  return (
    <div
      style={raised ? { ...shade(shadeColor), background } : { background }}
      className={`rounded-panel p-6 ${
        raised ? "chunky" : "border-2 border-rule bg-surface"
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
