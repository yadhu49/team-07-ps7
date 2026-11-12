import AppHeader from "@/components/AppHeader";
import DeliveriesBoard from "@/components/DeliveriesBoard";

export const metadata = { title: "Deliveries · RouteWise" };

export default function BoardPage() {
  return (
    <main className="relative z-10 mx-auto max-w-[1600px] p-4 md:p-6">
      <AppHeader />
      <DeliveriesBoard />
    </main>
  );
}
