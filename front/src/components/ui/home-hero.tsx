import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "./button";
import { HeroMotion } from "./hero-motion";

export function HomeHero() {
  return (
    <header className="home-intro travel-hero">
      <HeroMotion />
      <div className="travel-hero-copy">
        <h1 className="page-title">Planeje a próxima viagem.</h1>
        <p className="travel-hero-description">Escolha o destino e crie seu roteiro.</p>
        <div className="travel-hero-actions">
          <Button size="lg" variant="secondary" asChild><Link to="/roteiros/criacao"><Plus aria-hidden="true" />Criar novo roteiro</Link></Button>
          <Button size="lg" variant="ghost" className="travel-hero-explore" asChild><Link to="/destinos">Ver destinos<ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
        </div>
      </div>
    </header>
  );
}
