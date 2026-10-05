import { QuizResultClient } from "@/components/quiz/QuizResultClient";
import { getAllSchools } from "@/lib/schools";

export const metadata = {
  title: "Your school · Sophecs",
  description:
    "The school of ethics your answers place you closest to, and what it commits you to.",
};

// Server wrapper only exists to hand the (fs-backed) school content down to
// the client component as plain props — everything else on this transient
// page runs client-side against sessionStorage.
export default function QuizResultPage() {
  const schools = getAllSchools();
  return <QuizResultClient schools={schools} />;
}
