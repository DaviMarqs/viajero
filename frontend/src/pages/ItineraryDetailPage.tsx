import { ItineraryStopCard, BottomNav } from "../components/ui/ViajeroUI";
import { itineraryStops } from "../data/mockTravel";

export function ItineraryDetailPage() {
  return (
    <section className="screen">
      <div className="screen-scroll">
        <div className="status-bar">
          <span>13:37</span>
        </div>
        <div className="back-link">Voltar</div>
        <div className="screen-heading">
          <h1>Florianópolis</h1>
        </div>
        <p className="muted-copy">
          Confira um roteiro com as melhores programações para você curtir ainda mais a sua viagem sem se preocupar em pensar em cada detalhe!
        </p>

        <div className="tabs">
          <span className="tab">Dia 01</span>
          <span className="tab active">Dia 02</span>
          <span className="tab">Dia 03</span>
          <span className="tab">Dia 04</span>
        </div>

        <div className="day-divider">Início do dia</div>
        {itineraryStops.map((stop, index) => (
          <div className="stack" key={`${stop.title}-${index}`}>
            <ItineraryStopCard stop={stop} />
            {index < itineraryStops.length - 1 ? <div className="day-divider">15 min de caminhada</div> : null}
          </div>
        ))}
      </div>
      <BottomNav />
    </section>
  );
}
