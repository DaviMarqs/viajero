import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import travelPhoto from '@/assets/trip-example.jpg';

export function AuthLayout({ title, description, children, storySide = 'left', login = false }: {
  title: string; description: string; children: ReactNode; storySide?: 'left' | 'right'; login?: boolean;
}) {
  return <div className={`auth-layout ${login ? 'auth-layout-login' : ''}`}>
    <section className={`auth-story ${storySide === 'right' ? 'lg:order-2' : ''}`} aria-label="Viajero">
      {!login && <Link to="/login" className="auth-brand">Viajero</Link>}
      {!login && <img src={travelPhoto} alt="Barcos coloridos junto a uma praia de águas transparentes" className="auth-photo" width={500} height={270} />}
      <div className="auth-story-copy"><h2>{title}</h2><p>{description}</p></div>
    </section>
    <section className={`auth-form-panel ${storySide === 'right' ? 'lg:order-1' : ''}`}>{children}</section>
  </div>;
}
