// Nav now lives in the root layout so every route has it, not just this one.
export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
