import AppHeader from "@/components/AppHeader";
import RiderView from "@/components/RiderView";

export const metadata = { title: "Rider view · RouteWise" };

export default function RiderPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      <AppHeader />
      <RiderView />
    </main>
  );
}
