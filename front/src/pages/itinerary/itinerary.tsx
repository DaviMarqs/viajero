"use client";

import { useState } from "react";
import DaySelector from "@/components/ui/day-selector";
import RoadTrip from "@/components/ui/road-trip";
import Weather from "@/components/ui/weather";
import Locomotion from "@/components/ui/locomotion";

export default function Itinerary() {
  const [selectedDay, setSelectedDay] = useState(1);

  return (
    <section className="flex flex-col gap-6 p-4 sm:p-8 w-full overflow-x-hidden">
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold">
          Roteiro para Salvador, Bahia! 🌴
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Que tal uma viagem de aventura com clima tropical para sua próxima
          folga?
        </p>
      </div>

      <DaySelector
        totalDays={7}
        selectedDay={selectedDay}
        onSelect={setSelectedDay}
      />

      <div className="flex flex-col lg:flex-row gap-4 w-full">
        <div className="flex flex-col gap-6">
          <RoadTrip />
          <Locomotion type="walking" duration="15 MIN" />
          <RoadTrip />
          <Locomotion type="car" duration="10 MIN" />
          <RoadTrip />
          <Locomotion type="bus" duration="30 MIN" />
          <RoadTrip />
        </div>
        <div className="w-full lg:w-auto lg:flex-shrink-0">
          <Weather />
        </div>
      </div>
    </section>
  );
}
