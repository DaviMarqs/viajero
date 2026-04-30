import { NavLink } from "react-router-dom";

import { beachHighlight } from "../data/mockTravel";
import { BottomNav, DestinationCard } from "../components/ui/ViajeroUI";

export function DestinationDiscoveryPage() {
  return (
    <section className="screen">
      <div className="screen-scroll">
        <div className="status-bar">
          <span>13:37</span>
        </div>
        <div className="screen-heading">
          <h1>Bom dia, Felipe! 👋</h1>
          <p className="muted-copy large">Que tal uma viagem de aventura com clima tropical para sua próxima folga?</p>
        </div>

        <div className="section">
          <div className="section-title-row">
            <h3 className="section-title">Meus roteiros</h3>
            <span className="section-link">Ver todos</span>
          </div>
          <div className="empty-panel">
            <div className="empty-icon">+</div>
            <h3 className="section-title">Nenhum roteiro salvo</h3>
            <p className="muted-copy large">Explore destinos e salve os que mais combinam com você para começar.</p>
            <NavLink className="btn btn-primary" to="/generate">
              Criar roteiro do zero
            </NavLink>
            <NavLink className="btn btn-secondary" to="/itineraries/1/timeline">
              Explorar destinos
            </NavLink>
          </div>
        </div>

        <div className="divider" />

        <div className="pill-row">
          <button className="filter-pill active">Todos</button>
          <button className="filter-pill">Natureza</button>
          <button className="filter-pill">Compras</button>
          <button className="filter-pill">Internacional</button>
        </div>

        <div className="section">
          <div className="section-title-row">
            <h3 className="section-title">Praias encantadoras</h3>
            <span className="section-link">Ver todos</span>
          </div>
          <DestinationCard actionTo="/destinations/2" card={beachHighlight} showRecommendation={false} />
        </div>
      </div>
      <BottomNav />
      <div className="footer-indicator">
        <div className="home-indicator" />
      </div>
    </section>
  );
}
