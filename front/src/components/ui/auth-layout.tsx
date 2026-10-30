import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import travelPhoto from '@/assets/trip-example.jpg';

export function AuthLayout({ title, description, children, storySide = 'left' }: {
  title: string; description: string; children: ReactNode; storySide?: 'left' | 'right';
}) {
  return <div className="auth-layout">
    <section className={`auth-story ${storySide === 'right' ? 'lg:order-2' : ''}`} aria-label="Viajero">
      <Link to="/login" className="auth-brand">Viajero</Link>
      <img src={travelPhoto} alt="Barcos coloridos junto a uma praia de águas transparentes" className="auth-photo" width={500} height={270} />
      <div className="auth-story-copy"><h2>{title}</h2><p>{description}</p></div>
    </section>
    <section className={`auth-form-panel ${storySide === 'right' ? 'lg:order-1' : ''}`}>{children}</section>
  </div>;
}
