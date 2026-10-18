import { PlanView } from "@/components/plan/PlanView";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <PlanView date={date} />;
}
