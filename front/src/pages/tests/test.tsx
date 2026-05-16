import Sidebar from "@/components/ui/Sidebar"; 
import Weather from "@/components/ui/weather";

export default function Test() {
  return (
    <div className="flex gap-8">
      <Sidebar />
      <Weather />
    </div>
  );
}
