import { LucideIcon, Footprints, Car, Bus, Bike, Plane, Ship } from "lucide-react";

type LocomotionType = "walking" | "car" | "bus" | "bike" | "plane" | "ship";

type LocomotionProps = {
  type: LocomotionType;
  duration: string;
};

type ConfigItem = {
  icon: LucideIcon;
  label: string;
};

const config: { [key in LocomotionType]: ConfigItem } = {
  walking: { icon: Footprints, label: "DE CAMINHADA" },
  car:     { icon: Car,        label: "DE CARRO" },
  bus:     { icon: Bus,        label: "DE ÔNIBUS" },
  bike:    { icon: Bike,       label: "DE BICICLETA" },
  plane:   { icon: Plane,      label: "DE AVIÃO" },
  ship:    { icon: Ship,       label: "DE BARCO" },
};

export default function Locomotion({ type, duration }: LocomotionProps) {
  const { icon: Icon, label } = config[type];

  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex items-center gap-2 border border-neutral-200 rounded-full px-4 py-2 bg-white w-fit">
        <Icon size={16} className="text-neutral-400" />
        <span className="text-xs font-semibold tracking-widest text-neutral-500">
          {duration} {label}
        </span>
      </div>
    </div>
  );
}