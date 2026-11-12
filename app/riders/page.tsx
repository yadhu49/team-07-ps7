import AppHeader from "@/components/AppHeader";
import RidersPanel from "@/components/RidersPanel";

export const metadata = { title: "Riders · RouteWise" };

export default function RidersPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <AppHeader />
      <RidersPanel />
    </main>
  );
}
