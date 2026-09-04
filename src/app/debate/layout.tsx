import { SiteNav } from "@/components/nav/SiteNav";

export default function DebateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
