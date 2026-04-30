import { NavLink } from "react-router-dom";

import { BottomNav, TestimonialCard } from "../components/ui/ViajeroUI";
import { destinationDetail } from "../data/mockTravel";

export function DestinationDetailPage() {
  return (
    <section className="screen">
      <div className="top-hero-image">
        <img alt={destinationDetail.title} src={destinationDetail.hero} />
      </div>
      <div className="screen-scroll">
        <div className="stack">
          <div className="screen-heading">
            <h1>{destinationDetail.title}</h1>
            <p className="muted-copy large">{destinationDetail.subtitle}</p>
          </div>
          <div className="chip-row">
            {destinationDetail.badges.map((badge) => (
              <span className={`chip ${badge.includes("match") ? "" : ""}`.trim()} key={badge}>
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Sobre o destino</h3>
          <p className="detail-copy">{destinationDetail.about}</p>
        </div>

        <div className="section">
          <h3 className="section-title">Melhor época para ir</h3>
          <div className="detail-card-grid">
            {destinationDetail.bestTime.map((period) => (
              <div className="mini-card" key={period.title}>
                <h4>{period.title}</h4>
                <p>{period.subtitle}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">O que esperar?</h3>
          <ul className="bullets">
            {destinationDetail.expectations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="section">
          <h3 className="section-title">Atrações imperdíveis</h3>
          <div className="detail-list">
            {destinationDetail.attractions.map((item) => (
              <article className="detail-list-card" key={item.title}>
                <div className="destination-card-body">
                  <div className="card-actions">
                    <img alt={item.title} src={item.image} style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} />
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="section-link">{item.tag}</span>
                      <strong>{item.title}</strong>
                      <p className="list-copy">{item.description}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Como se preparar</h3>
          <ul className="bullets">
            {destinationDetail.prep.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="section">
          <h3 className="section-title">Dicas importantes</h3>
          <ul className="bullets">
            {destinationDetail.tips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="section">
          <h3 className="section-title">Gastronomia local</h3>
          <div className="detail-list">
            {destinationDetail.cuisine.map((item) => (
              <article className="detail-list-card" key={item.title}>
                <div className="destination-card-body">
                  <div className="card-actions">
                    <img alt={item.title} src={item.image} style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} />
                    <div className="stack" style={{ gap: 2 }}>
                      <strong>{item.title}</strong>
                      <p className="list-copy">{item.description}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">O que outros viajantes dizem</h3>
          <div className="testimonial-row">
            {destinationDetail.testimonials.map((testimonial) => (
              <TestimonialCard key={testimonial.name} name={testimonial.name} text={testimonial.text} />
            ))}
          </div>
        </div>

        <NavLink className="btn btn-primary" to="/itineraries/1">
          Gerar roteiro com estes pontos
        </NavLink>
      </div>
      <BottomNav />
    </section>
  );
}
