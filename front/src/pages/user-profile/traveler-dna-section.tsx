"use client";

import { useEffect, useState } from "react";
import { useTravelerDNAProfile } from "@/hooks/useTravelerDNAProfile";
import {
  Compass,
  Gauge,
  Crown,
  Users,
  Mountain,
  UtensilsCrossed,
  Music,
  Leaf,
  StickyNote,
  Pencil,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

const TRAVEL_STYLE_OPTIONS = [
  { label: "Aventura", value: "adventure" },
  { label: "Equilibrado", value: "balanced" },
  { label: "Relaxado", value: "relaxed" },
];

const PACE_OPTIONS = [
  { label: "Leve", value: "slow" },
  { label: "Moderado", value: "moderate" },
  { label: "Intenso", value: "fast" },
];

const COMFORT_OPTIONS = [
  { label: "Economico", value: "budget" },
  { label: "Intermediario", value: "mid" },
  { label: "Premium", value: "premium" },
];

const SLIDERS: { key: SliderKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "social_energy",
    label: "Energia social",
    icon: <Users className="size-3.5" />,
  },
  {
    key: "adventure_level",
    label: "Nivel de aventura",
    icon: <Mountain className="size-3.5" />,
  },
  {
    key: "food_focus",
    label: "Foco em gastronomia",
    icon: <UtensilsCrossed className="size-3.5" />,
  },
  {
    key: "cultural_interest",
    label: "Interesse cultural",
    icon: <Crown className="size-3.5" />,
  },
  {
    key: "nature_interest",
    label: "Interesse em natureza",
    icon: <Leaf className="size-3.5" />,
  },
  {
    key: "nightlife_interest",
    label: "Vida noturna",
    icon: <Music className="size-3.5" />,
  },
];

type SliderKey =
  | "social_energy"
  | "adventure_level"
  | "food_focus"
  | "cultural_interest"
  | "nature_interest"
  | "nightlife_interest";

interface FormState {
  travel_style: string;
  pace: string;
  comfort_level: string;
  social_energy: number;
  adventure_level: number;
  food_focus: number;
  cultural_interest: number;
  nature_interest: number;
  nightlife_interest: number;
  notes: string;
}

const initial: FormState = {
  travel_style: "",
  pace: "",
  comfort_level: "",
  social_energy: 5,
  adventure_level: 5,
  food_focus: 5,
  cultural_interest: 5,
  nature_interest: 5,
  nightlife_interest: 5,
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition";

function labelFor(
  options: { label: string; value: string }[],
  value: string | undefined | null,
) {
  return options.find((o) => o.value === value)?.label ?? "-";
}

interface Props {
  token: string;
}

export function TravelerDNASection({ token }: Props) {
  const { profile, loading, error, saving, saveError, save } =
    useTravelerDNAProfile(token);

  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    if (!profile) return;
    setForm({
      travel_style: profile.travel_style ?? "",
      pace: profile.pace ?? "",
      comfort_level: profile.comfort_level ?? "",
      social_energy: profile.social_energy ?? 5,
      adventure_level: profile.adventure_level ?? 5,
      food_focus: profile.food_focus ?? 5,
      cultural_interest: profile.cultural_interest ?? 5,
      nature_interest: profile.nature_interest ?? 5,
      nightlife_interest: profile.nightlife_interest ?? 5,
      notes: profile.notes ?? "",
    });
  }, [profile]);

  async function handleSave() {
    setSuccess(false);
    try {
      await save(form);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      /* exibe saveError */
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex items-center gap-2 text-sm text-neutral-400">
        <Loader2 className="size-4 animate-spin" />
        Carregando preferencias do viajante...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="size-4" />
        {error}
      </div>
    );
  }

  const hasData = !!profile;

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-neutral-700">
            Preferencias do viajante
          </h2>
          {!hasData && !editing && (
            <p className="text-xs text-neutral-400 mt-0.5">
              Sem DNA salvo ainda. Clique em editar para preencher.
            </p>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
        )}
      </div>

      {!editing && hasData && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
            <ReadOnly icon={<Compass className="size-3.5" />} label="Estilo">
              {labelFor(TRAVEL_STYLE_OPTIONS, profile?.travel_style)}
            </ReadOnly>
            <ReadOnly icon={<Gauge className="size-3.5" />} label="Ritmo">
              {labelFor(PACE_OPTIONS, profile?.pace)}
            </ReadOnly>
            <ReadOnly icon={<Crown className="size-3.5" />} label="Conforto">
              {labelFor(COMFORT_OPTIONS, profile?.comfort_level)}
            </ReadOnly>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SLIDERS.map((s) => (
              <ReadOnlySlider
                key={s.key}
                icon={s.icon}
                label={s.label}
                value={profile ? (profile[s.key] as number) : 0}
              />
            ))}
          </div>
          {profile?.notes && (
            <ReadOnly icon={<StickyNote className="size-3.5" />} label="Notas">
              {profile.notes}
            </ReadOnly>
          )}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldGroup icon={<Compass className="size-3.5" />} label="Estilo">
              <select
                className={inputClass}
                value={form.travel_style}
                onChange={(e) =>
                  setForm((f) => ({ ...f, travel_style: e.target.value }))
                }
              >
                <option value="">Selecionar...</option>
                {TRAVEL_STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup icon={<Gauge className="size-3.5" />} label="Ritmo">
              <select
                className={inputClass}
                value={form.pace}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pace: e.target.value }))
                }
              >
                <option value="">Selecionar...</option>
                {PACE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup icon={<Crown className="size-3.5" />} label="Conforto">
              <select
                className={inputClass}
                value={form.comfort_level}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comfort_level: e.target.value }))
                }
              >
                <option value="">Selecionar...</option>
                {COMFORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SLIDERS.map((s) => (
              <FieldGroup
                key={s.key}
                icon={s.icon}
                label={`${s.label} - ${form[s.key]}`}
              >
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={form[s.key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [s.key]: Number(e.target.value) }))
                  }
                  className="w-full accent-blue-500"
                />
              </FieldGroup>
            ))}
          </div>

          <FieldGroup icon={<StickyNote className="size-3.5" />} label="Notas">
            <textarea
              className={inputClass}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Algo mais que a IA precise saber?"
            />
          </FieldGroup>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 border border-neutral-200 hover:bg-neutral-50 px-4 py-2 rounded-xl transition-colors"
            >
              <X className="size-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="size-4 shrink-0" />
          {saveError}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <Check className="size-4 shrink-0" />
          Preferencias do viajante atualizadas!
        </div>
      )}
    </div>
  );
}

function ReadOnly({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">
        {icon}
        {label}
      </span>
      <p className="text-sm text-neutral-800 font-medium pl-0.5 whitespace-pre-wrap">
        {children}
      </p>
    </div>
  );
}

function ReadOnlySlider({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / 10) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">
          {icon}
          {label}
        </span>
        <span className="text-xs font-mono text-neutral-500">{value}/10</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FieldGroup({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
