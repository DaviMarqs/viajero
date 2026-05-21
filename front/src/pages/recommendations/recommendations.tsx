import Filter from "@/components/ui/filter";
import TripRecomendation from "@/components/ui/trip-recomendation";

export default function Recommendations() {
  return (
    <div className="flex flex-col bg-neutral-50 md:flex-row py-8 md:py-12 px-4 md:px-4 gap-6 max-w-5xl w-full">
      <div className="w-full md:w-fit md:flex-shrink-0">
        <Filter />
      </div>

      <div className="flex flex-col gap-4 flex-1 min-w-0">
        <div>
          <h2 className="text-2xl md:text-4xl font-medium leading-snug">
            Encontramos os melhores destinos para você!
          </h2>
        </div>
        <p className="text-neutral-600 text-sm md:text-base">
          Baseado no seu perfil de viajante explorador e preferências de clima
          temperado.
        </p>
        <TripRecomendation />
        <TripRecomendation />
        <TripRecomendation />
      </div>
    </div>
  );
}