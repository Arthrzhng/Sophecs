// A placeholder for content that is genuinely in flight. Static, not
// shimmering: a pulsing skeleton is motion that is not a response to
// anything the user did, which the brief rules out.
export function Skeleton({
  className = "",
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className={`bg-rule ${className}`}>
      <span className="sr-only">{label}</span>
    </div>
  );
}
