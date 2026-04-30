import { NavLink } from "react-router-dom";
import { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";

import { MockDestinationCard, MockItineraryStop } from "../../data/mockTravel";

type IconProps = {
  className?: string;
  size?: number;
};

function createIcon(path: ReactNode) {
  return function Icon({ className, size = 24 }: IconProps) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {path}
      </svg>
    );
  };
}

export const IconChevronLeft = createIcon(<path d="M15 18l-6-6 6-6" />);
export const IconChevronRight = createIcon(<path d="M9 6l6 6-6 6" />);
export const IconWifi = createIcon(
  <>
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <path d="M12 20h.01" />
  </>,
);
export const IconBattery = createIcon(
  <>
    <rect x="3" y="7" width="16" height="10" rx="2" />
    <path d="M21 11v2" />
    <path d="M6 10h10v4H6z" fill="currentColor" stroke="none" />
  </>,
);
export const IconUser = createIcon(
  <>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
  </>,
);
export const IconHeart = createIcon(<path d="M12 20s-6.7-4.3-8.5-8a4.9 4.9 0 0 1 8.5-4.3A4.9 4.9 0 0 1 20.5 12C18.7 15.7 12 20 12 20Z" />);
export const IconUsers = createIcon(
  <>
    <path d="M16.5 19a4.5 4.5 0 0 0-9 0" />
    <circle cx="12" cy="8.5" r="3" />
    <path d="M20 19a4 4 0 0 0-3.2-3.9" />
    <path d="M17.5 5.5a2.6 2.6 0 1 1 0 5.2" />
  </>,
);
export const IconFootprints = createIcon(
  <>
    <path d="M9 9c0 2-1 4-2 4s-2-2-2-4 1-4 2-4 2 2 2 4Z" />
    <path d="M7 18c0 1.7-.8 3-1.8 3S3.5 19.7 3.5 18s.8-3 1.7-3S7 16.3 7 18Z" />
    <path d="M18 9c0 2 1 4 2 4s2-2 2-4-1-4-2-4-2 2-2 4Z" />
    <path d="M17 18c0 1.7.8 3 1.8 3s1.7-1.3 1.7-3-.8-3-1.7-3S17 16.3 17 18Z" />
  </>,
);
export const IconBed = createIcon(
  <>
    <path d="M4 11V7a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v3" />
    <path d="M2 13h20" />
    <path d="M4 13v6" />
    <path d="M20 13v6" />
    <path d="M14 10h4a2 2 0 0 1 2 2v1" />
  </>,
);
export const IconLeaf = createIcon(<path d="M20 4c-6 0-10 3.5-10 9a5 5 0 0 0 10 0c0-2.7-1.3-5.4-4-9Z" />);
export const IconGauge = createIcon(
  <>
    <path d="M4.5 15a7.5 7.5 0 1 1 15 0" />
    <path d="M12 12l3.5-3.5" />
  </>,
);
export const IconList = createIcon(
  <>
    <path d="M9 7h10" />
    <path d="M9 12h10" />
    <path d="M9 17h10" />
    <path d="M5 7h.01" />
    <path d="M5 12h.01" />
    <path d="M5 17h.01" />
  </>,
);
export const IconBuilding = createIcon(
  <>
    <path d="M4 20V7a1 1 0 0 1 1-1h6v14" />
    <path d="M11 20V4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
    <path d="M7 10h1" />
    <path d="M7 13h1" />
    <path d="M14 8h1" />
    <path d="M17 8h1" />
    <path d="M14 11h1" />
    <path d="M17 11h1" />
  </>,
);
export const IconCalendar = createIcon(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4" />
    <path d="M8 3v4" />
    <path d="M3 10h18" />
  </>,
);
export const IconInfo = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v5" />
    <path d="M12 7h.01" />
  </>,
);
export const IconSun = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5" />
    <path d="M12 19.5V22" />
    <path d="M4.9 4.9 6.7 6.7" />
    <path d="M17.3 17.3l1.8 1.8" />
  </>,
);
export const IconMap = createIcon(
  <>
    <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2Z" />
    <path d="M9 4v14" />
    <path d="M15 6v14" />
  </>,
);
export const IconPlane = createIcon(<path d="M10 14 3 17l2-5-2-5 7 3 8-7 3 1-5 9 3 7-2 1-5-6-4 3Z" />);
export const IconNews = createIcon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 8h8" />
    <path d="M8 12h8" />
    <path d="M8 16h5" />
  </>,
);
export const IconLightbulb = createIcon(
  <>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a6 6 0 0 0-3 11.2c.6.4 1 1 1 1.8h4c0-.8.4-1.4 1-1.8A6 6 0 0 0 12 2Z" />
  </>,
);

export function StatusBar() {
  return (
    <div className="status-bar">
      <span>13:37</span>
      <div className="status-icons">
        <IconWifi size={18} />
        <IconBattery size={18} />
      </div>
    </div>
  );
}

export function HomeIndicator() {
  return (
    <div className="footer-indicator">
      <div className="home-indicator" />
    </div>
  );
}

export function MobilePage({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <section className="screen">
      <div className={`screen-scroll ${className}`.trim()}>
        <StatusBar />
        {children}
      </div>
    </section>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  backTo,
  skipTo,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  skipTo?: string;
}) {
  return (
    <>
      {(backTo || skipTo) && (
        <div className="top-actions">
          {backTo ? (
            <NavLink className="back-link" to={backTo}>
              <IconChevronLeft size={20} />
              <span>Voltar</span>
            </NavLink>
          ) : (
            <span />
          )}
          {skipTo ? (
            <NavLink className="ghost-link" to={skipTo}>
              Pular essa etapa
            </NavLink>
          ) : null}
        </div>
      )}
      <div className="screen-heading">
        <h2>{title}</h2>
        {subtitle ? <p className="screen-subtitle">{subtitle}</p> : null}
      </div>
    </>
  );
}

export function PrimaryButton({ children, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className="btn btn-primary" {...props}>
      <span>{children}</span>
      <IconChevronRight size={20} />
    </button>
  );
}

export function SecondaryButton({ children, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className="btn btn-secondary" {...props}>
      {children}
    </button>
  );
}

export function OptionCard({
  icon,
  title,
  description,
  selected = false,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={`option-card ${selected ? "selected" : ""}`.trim()} onClick={onClick} type="button">
      <div className="icon-box">{icon}</div>
      <div className="option-card-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className={`checkbox ${selected ? "checked" : ""}`.trim()}>{selected ? "✓" : ""}</span>
    </button>
  );
}

export function FormField({
  label,
  required,
  optional,
  icon,
  children,
  hint,
}: PropsWithChildren<{ label: string; required?: boolean; optional?: boolean; icon?: ReactNode; hint?: string }>) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required ? <small>*</small> : null}
        {optional ? <small className="optional">(opcional)</small> : null}
      </span>
      <div className={typeof children === "string" ? "input-control" : "input-control"}>
        {icon}
        {children}
      </div>
      {hint ? (
        <span className="hint">
          <IconInfo size={20} />
          <span>{hint}</span>
        </span>
      ) : null}
    </label>
  );
}

export function TextAreaField({
  label,
  optional,
  value,
  onChange,
  hint,
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {optional ? <small className="optional">(opcional)</small> : null}
      </span>
      <div className="textarea-control">
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
      {hint ? (
        <span className="hint">
          <IconInfo size={20} />
          <span>{hint}</span>
        </span>
      ) : null}
    </label>
  );
}

export function ChipGroup({
  items,
  selected,
  onToggle,
}: {
  items: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="chip-row">
      {items.map((item) => {
        const active = selected.includes(item);
        return (
          <button key={item} className={`chip ${active ? "selected" : ""}`.trim()} onClick={() => onToggle(item)} type="button">
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <IconUser className="sr-only" />
        <IconMap size={22} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/generate">
        <IconGauge size={22} />
        <span>Em Alta</span>
      </NavLink>
      <NavLink to="/itineraries/1">
        <IconMap size={22} />
        <span>Roteiros</span>
      </NavLink>
      <NavLink to="/favorites">
        <IconUser size={22} />
        <span>Perfil</span>
      </NavLink>
    </nav>
  );
}

export function DestinationCard({
  card,
  actionTo,
  showRecommendation = true,
}: {
  card: MockDestinationCard;
  actionTo: string;
  showRecommendation?: boolean;
}) {
  return (
    <article className="destination-card">
      <img alt={card.title} src={card.image} />
      <div className="destination-card-body">
        <div className="stack">
          <h3 className="destination-card-title">{card.title}</h3>
          {showRecommendation && card.recommendation ? <div className="badge-note">{card.recommendation}</div> : null}
          <div className="meta-row">
            <span>{card.price}</span>
            <span className="dot" />
            <span>{card.duration}</span>
          </div>
          <p className="muted-copy large">{card.subtitle}</p>
        </div>
        <div className="card-actions">
          <NavLink className="btn btn-primary" to={actionTo}>
            <span>Ver roteiro</span>
            <IconChevronRight size={20} />
          </NavLink>
          <button className="icon-button" type="button" aria-label="Salvar">
            <IconHeart size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ItineraryStopCard({ stop }: { stop: MockItineraryStop }) {
  return (
    <article className="itinerary-card">
      <img alt={stop.title} src={stop.image} />
      <div className="itinerary-card-body">
        <div className="stack">
          <div className="section-title-row">
            <h3 className="section-title">{stop.title}</h3>
            <span className="section-link">{stop.time}</span>
          </div>
          <p className="muted-copy">{stop.description}</p>
        </div>
        {stop.tip ? (
          <div className="tip-box">
            <IconLightbulb size={20} />
            <span>{stop.tip}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function TestimonialCard({ name, text }: { name: string; text: string }) {
  return (
    <article className="testimonial-card">
      <div className="testimonial-head">
        <div className="avatar">{name[0]}</div>
        <strong>{name}</strong>
      </div>
      <p className="list-copy">{text}</p>
      <span className="translated">(Traduzido)</span>
    </article>
  );
}
