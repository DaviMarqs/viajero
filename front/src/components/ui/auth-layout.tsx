import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import tripImage from '@/assets/trip-example.jpg';

export function AuthLayout({ title, description, children, storySide = 'left' }: {
  title: string; description: string; children: ReactNode; storySide?: 'left' | 'right';
}) {
  return <div className="auth-layout">
    <section className={`auth-story ${storySide === 'right' ? 'lg:order-2' : ''}`} aria-label="Viajero">
      <Link to="/login" className="w-fit font-display text-[28px] font-semibold tracking-tight text-primary">Viajero</Link>
      <img className="auth-photo" src={tripImage} alt="Barcos em uma praia de águas cristalinas" />
      <div className="space-y-4"><h2>{title}</h2><p>{description}</p></div>
    </section>
    <section className={`auth-form-panel ${storySide === 'right' ? 'lg:order-1' : ''}`}>{children}</section>
  </div>;
}
