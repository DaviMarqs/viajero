import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import storyBackground from '@/assets/bcg-left.svg';

export function AuthLayout({ title, description, children, storySide = 'left' }: {
  title: string; description: string; children: ReactNode; storySide?: 'left' | 'right';
}) {
  return <div className="auth-layout">
    <section style={{ backgroundImage: `url(${storyBackground})` }} className={`auth-story ${storySide === 'right' ? 'lg:order-2' : ''}`} aria-label="Viajero">
      <Link to="/login" className="auth-brand">Viajero</Link>
      <div className="space-y-4"><h2>{title}</h2><p>{description}</p></div>
    </section>
    <section className={`auth-form-panel ${storySide === 'right' ? 'lg:order-1' : ''}`}>{children}</section>
  </div>;
}
