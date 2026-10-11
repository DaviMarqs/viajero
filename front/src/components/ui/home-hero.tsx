import { Link } from "react-router-dom";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "./button";
import { HeroMotion } from "./hero-motion";

export function HomeHero() {
  return (
    <header className="home-intro travel-hero">
      <HeroMotion />
      <div className="travel-hero-copy">
        <h1 className="page-title">Sua próxima viagem começa aqui</h1>
        <p className="travel-hero-description">Um painel para descobrir, planejar e retomar roteiros.</p>
        <div className="travel-hero-actions">
          <Button size="lg" asChild><Link to="/roteiros/criacao"><Plus aria-hidden="true" />Criar novo roteiro</Link></Button>
          <Link className="travel-hero-explore" to="/destinos">Explorar destinos<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
    </header>
  );
}