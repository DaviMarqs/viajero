import { NavLink } from "react-router-dom";

import { HomeIndicator } from "../components/ui/ViajeroUI";

const heroImage = "https://www.figma.com/api/mcp/asset/44b333b8-b417-4f34-8054-bdce280e2920";

export function LoginPage() {
  return (
    <section className="auth-screen">
      <div className="hero-photo" style={{ backgroundImage: `url(${heroImage})` }} />
      <div className="hero-sheet">
        <div className="hero-copy">
          <h2>Descubra seu próximo destino</h2>
          <p className="muted-copy large">
            Junte-se a milhares de viajantes e descubra destinos incríveis com roteiros personalizados de acordo com a sua necessidade!
          </p>
        </div>
        <div className="stack">
          <NavLink className="btn btn-primary" to="/register">
            <span>Criar minha conta</span>
          </NavLink>
          <NavLink className="btn btn-secondary" to="/">
            Já possuo uma conta
          </NavLink>
        </div>
        <HomeIndicator />
      </div>
    </section>
  );
}
