import { SiteNav } from "@/components/nav/SiteNav";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
