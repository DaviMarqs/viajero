import { savedCards } from "../data/mockTravel";
import { BottomNav, DestinationCard, ScreenHeader } from "../components/ui/ViajeroUI";

export function FavoritesPage() {
  return (
    <section className="screen">
      <div className="screen-scroll">
        <ScreenHeader title="Roteiros salvos" subtitle="Baseado no seu perfil de viajante explorador e preferências de clima temperado." />
        <div className="stack">
          {savedCards.map((card) => (
            <DestinationCard key={card.id} actionTo="/itineraries/1" card={card} />
          ))}
        </div>
      </div>
      <BottomNav />
    </section>
  );
}
