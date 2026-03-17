import { CatapulseDashboard } from "@/components/catapulse/catapulse-dashboard";
import { getDashboardPayload } from "@/lib/catapulse-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboard = await getDashboardPayload();

  return <CatapulseDashboard dashboard={dashboard} />;
}
