import { recommendationCards } from "../data/mockTravel";
import { BottomNav, DestinationCard, ScreenHeader } from "../components/ui/ViajeroUI";

export function ItineraryTimelinePage() {
  return (
    <section className="screen">
      <div className="screen-scroll">
        <ScreenHeader title="Encontramos os melhores destinos para você!" subtitle="Baseado no seu perfil de viajante explorador e preferências de clima temperado." />
        <div className="stack">
          {recommendationCards.map((card) => (
            <DestinationCard key={card.id} actionTo={`/destinations/${card.id}`} card={card} />
          ))}
        </div>
      </div>
      <BottomNav />
    </section>
  );
}
