import { QuizResultClient } from "@/components/quiz/QuizResultClient";
import { getAllSchools } from "@/lib/schools";

// Server wrapper only exists to hand the (fs-backed) school content down to
// the client component as plain props — everything else on this transient
// page runs client-side against sessionStorage.
export default function QuizResultPage() {
  const schools = getAllSchools();
  return <QuizResultClient schools={schools} />;
}
