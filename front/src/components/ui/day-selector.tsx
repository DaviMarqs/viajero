"use client";

type DaySelectorProps = {
  totalDays: number;
  selectedDay: number;
  onSelect: (day: number) => void;
};

export default function DaySelector({
  totalDays,
  selectedDay,
  onSelect,
}: DaySelectorProps) {
  return (
    <div className="flex items-center border border-neutral-300 rounded-2xl w-full sm:w-fit bg-neutral-100 px-1 py-1 gap-1 overflow-x-auto">
      {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
        const isSelected = day === selectedDay;
        return (
          <button
            key={day}
            onClick={() => onSelect(day)}
            className={`px-8 py-2 rounded-xl text-sm transition-all whitespace-nowrap flex-shrink-0 ${
              isSelected
                ? "bg-white font-semibold text-neutral-900 shadow-md"
                : "text-neutral-400 hover:text-neutral-700 font-normal"
            }`}
          >
            Dia {String(day).padStart(2, "0")}
          </button>
        );
      })}
    </div>
  );
}