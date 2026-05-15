import Sidebar from "@/components/ui/Sidebar";
import TripRecomendation from "@/components/ui/TripRecomendation";

export default function Test() {
  return (
    <div className="flex gap-8">
      <Sidebar />
      <div className="flex gap-4">
        <TripRecomendation />
      </div>
    </div>
  );
}
