import AppHeader from "@/components/AppHeader";
import SupervisorDashboard from "@/components/SupervisorDashboard";

export const metadata = { title: "Dashboard · RouteWise" };

export default function DashboardPage() {
  return (
    <main className="relative z-10 mx-auto max-w-[1500px] p-4 md:p-6">
      <AppHeader />
      <SupervisorDashboard />
    </main>
  );
}
