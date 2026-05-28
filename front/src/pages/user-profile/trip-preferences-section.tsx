"use client";

import { useEffect, useState } from "react";
import { useTripPreferences } from "@/hooks/useTripPreferences";
import {
  Wallet,
  CalendarDays,
  Hotel,
  Bus,
  Users,
  Salad,
  Accessibility,
  Sparkles,
  Pencil,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

const CURRENCY_OPTIONS = [
  { label: "Real (BRL)", value: "BRL" },
  { label: "Dolar (USD)", value: "USD" },
  { label: "Euro (EUR)", value: "EUR" },
  { label: "Libra (GBP)", value: "GBP" },
  { label: "Peso Arg. (ARS)", value: "ARS" },
];

const MONTH_OPTIONS = [
  { label: "Janeiro", value: "January" },
  { label: "Fevereiro", value: "February" },
  { label: "Março", value: "March" },
  { label: "Abril", value: "April" },
  { label: "Maio", value: "May" },
  { label: "Junho", value: "June" },
  { label: "Julho", value: "July" },
  { label: "Agosto", value: "August" },
  { label: "Setembro", value: "September" },
  { label: "Outubro", value: "October" },
  { label: "Novembro", value: "November" },
  { label: "Dezembro", value: "December" },
];

const TRIP_LENGTH_OPTIONS = [
  { label: "Final de semana (2-3 dias)", value: 3 },
  { label: "Semana curta (4-6 dias)", value: 5 },
  { label: "1 semana", value: 7 },
  { label: "2 semanas", value: 14 },
  { label: "3 semanas", value: 21 },
  { label: "1 mês ou mais", value: 30 },
];

const HOTEL_LEVEL_OPTIONS = [
  { label: "Essencial", value: "budget" },
  { label: "Confortável", value: "mid" },
  { label: "Padrão", value: "standard" },
  { label: "Elevado", value: "luxury" },
];

const TRANSPORT_OPTIONS = [
  { label: "Transporte público", value: "public" },
  { label: "Misto", value: "mixed" },
  { label: "Privado", value: "private" },
];

const COMPANIONSHIP_OPTIONS = [
  { label: "Sozinho", value: "solo" },
  { label: "Família", value: "family" },
  { label: "Casal", value: "couple" },
  { label: "Amigos", value: "friends" },
];

const DIETARY_OPTIONS = [
  { label: "Vegetariana", value: "vegetarian" },
  { label: "Vegana", value: "vegan" },
  { label: "Sem glúten", value: "gluten_free" },
  { label: "Sem lactose", value: "lactose_free" },
];

const ACCESSIBILITY_OPTIONS = [
  { label: "Mobilidade reduzida", value: "mobility" },
  { label: "Apoio auditivo", value: "hearing" },
  { label: "Apoio visual", value: "visual" },
];

const INTEREST_OPTIONS = [
  { label: "Gastronomia", value: "food" },
  { label: "Cultura", value: "culture" },
  { label: "Natureza", value: "nature" },
  { label: "Vida noturna", value: "nightlife" },
  { label: "Relaxamento", value: "wellness" },
  { label: "Compras", value: "shopping" },
];

interface FormState {
  budget_min: string;
  budget_max: string;
  currency_code: string;
  companionship: string;
  preferred_trip_length_days: number;
  travel_month: string;
  hotel_level: string;
  transportation_style: string;
  dietary_preferences: string[];
  accessibility_needs: string[];
  interests: string[];
}

const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition";

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function labelFor(
  options: { label: string; value: string | number }[],
  value: string | number | undefined | null,
) {
  return options.find((o) => String(o.value) === String(value))?.label ?? "-";
}

function joinLabels(
  options: { label: string; value: string }[],
  values: string[] | undefined | null,
) {
  if (!values || values.length === 0) return "-";
  return values
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .join(", ");
}

interface Props {
  token: string;
}

export function TripPreferencesSection({ token }: Props) {
  const { preferences, loading, error, saving, saveError, save } =
    useTripPreferences(token);

  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormState>({
    budget_min: "",
    budget_max: "",
    currency_code: "BRL",
    companionship: "",
    preferred_trip_length_days: 7,
    travel_month: "",
    hotel_level: "",
    transportation_style: "",
    dietary_preferences: [],
    accessibility_needs: [],
    interests: [],
  });

  useEffect(() => {
    if (!preferences) return;
    setForm({
      budget_min: String(preferences.budget_min ?? ""),
      budget_max: String(preferences.budget_max ?? ""),
      currency_code: preferences.currency_code ?? "BRL",
      companionship: preferences.companionship ?? "",
      preferred_trip_length_days: preferences.preferred_trip_length_days ?? 7,
      travel_month: preferences.travel_month ?? "",
      hotel_level: preferences.hotel_level ?? "",
      transportation_style: preferences.transportation_style ?? "",
      dietary_preferences: preferences.dietary_preferences ?? [],
      accessibility_needs: preferences.accessibility_needs ?? [],
      interests: preferences.interests ?? [],
    });
  }, [preferences]);

  async function handleSave() {
    setSuccess(false);
    try {
      await save({
        budget_min: Number(form.budget_min) || 0,
        budget_max: Number(form.budget_max) || 0,
        currency_code: form.currency_code,
        companionship: form.companionship,
        preferred_trip_length_days:
          Number(form.preferred_trip_length_days) || 0,
        travel_month: form.travel_month,
        hotel_level: form.hotel_level,
        transportation_style: form.transportation_style,
        dietary_preferences: form.dietary_preferences,
        accessibility_needs: form.accessibility_needs,
        interests: form.interests,
        metadata: preferences?.metadata ?? {},
      });
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      /* saveError ja exibido */
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex items-center gap-2 text-sm text-neutral-400">
        <Loader2 className="size-4 animate-spin" />
        Carregando preferências da viagem...
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

  const hasData = !!preferences;

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-neutral-700">
            Preferências da viagem
          </h2>
          {!hasData && !editing && (
            <p className="text-xs text-neutral-400 mt-0.5">
              Nenhuma preferência salva ainda. Clique em editar para preencher.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <ReadOnly icon={<Wallet className="size-3.5" />} label="Orçamento">
            {preferences?.budget_min} – {preferences?.budget_max}{" "}
            {preferences?.currency_code}
          </ReadOnly>
          <ReadOnly icon={<Users className="size-3.5" />} label="Companhia">
            {labelFor(COMPANIONSHIP_OPTIONS, preferences?.companionship)}
          </ReadOnly>
          <ReadOnly
            icon={<CalendarDays className="size-3.5" />}
            label="Duração ideal"
          >
            {labelFor(
              TRIP_LENGTH_OPTIONS,
              preferences?.preferred_trip_length_days,
            )}
          </ReadOnly>
          <ReadOnly
            icon={<CalendarDays className="size-3.5" />}
            label="Mês preferido"
          >
            {labelFor(MONTH_OPTIONS, preferences?.travel_month)}
          </ReadOnly>
          <ReadOnly icon={<Hotel className="size-3.5" />} label="Hospedagem">
            {labelFor(HOTEL_LEVEL_OPTIONS, preferences?.hotel_level)}
          </ReadOnly>
          <ReadOnly icon={<Bus className="size-3.5" />} label="Transporte">
            {labelFor(TRANSPORT_OPTIONS, preferences?.transportation_style)}
          </ReadOnly>
          <ReadOnly icon={<Sparkles className="size-3.5" />} label="Interesses">
            {joinLabels(INTEREST_OPTIONS, preferences?.interests)}
          </ReadOnly>
          <ReadOnly
            icon={<Salad className="size-3.5" />}
            label="Restrições alimentares"
          >
            {joinLabels(DIETARY_OPTIONS, preferences?.dietary_preferences)}
          </ReadOnly>
          <ReadOnly
            icon={<Accessibility className="size-3.5" />}
            label="Acessibilidade"
          >
            {joinLabels(
              ACCESSIBILITY_OPTIONS,
              preferences?.accessibility_needs,
            )}
          </ReadOnly>
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldGroup
              icon={<Wallet className="size-3.5" />}
              label="Orçamento mínimo"
            >
              <input
                type="number"
                className={inputClass}
                value={form.budget_min}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budget_min: e.target.value }))
                }
              />
            </FieldGroup>
            <FieldGroup
              icon={<Wallet className="size-3.5" />}
              label="Orçamento máximo"
            >
              <input
                type="number"
                className={inputClass}
                value={form.budget_max}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budget_max: e.target.value }))
                }
              />
            </FieldGroup>
            <FieldGroup icon={<Wallet className="size-3.5" />} label="Moeda">
              <select
                className={inputClass}
                value={form.currency_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency_code: e.target.value }))
                }
              >
                {CURRENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup icon={<Users className="size-3.5" />} label="Companhia">
              <select
                className={inputClass}
                value={form.companionship}
                onChange={(e) =>
                  setForm((f) => ({ ...f, companionship: e.target.value }))
                }
              >
                <option value="">Selecionar...</option>
                {COMPANIONSHIP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup
              icon={<CalendarDays className="size-3.5" />}
              label="Duração ideal"
            >
              <select
                className={inputClass}
                value={form.preferred_trip_length_days}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    preferred_trip_length_days: Number(e.target.value),
                  }))
                }
              >
                {TRIP_LENGTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup
              icon={<CalendarDays className="size-3.5" />}
              label="Mês preferido"
            >
              <select
                className={inputClass}
                value={form.travel_month}
                onChange={(e) =>
                  setForm((f) => ({ ...f, travel_month: e.target.value }))
                }
              >
                <option value="">Selecionar...</option>
                {MONTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup icon={<Hotel className="size-3.5" />} label="Hospedagem">
              <select
                className={inputClass}
                value={form.hotel_level}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hotel_level: e.target.value }))
                }
              >
                <option value="">Selecionar...</option>
                {HOTEL_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>

          <FieldGroup icon={<Bus className="size-3.5" />} label="Transporte">
            <select
              className={inputClass}
              value={form.transportation_style}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  transportation_style: e.target.value,
                }))
              }
            >
              <option value="">Selecionar...</option>
              {TRANSPORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldGroup>

          <TagPicker
            icon={<Sparkles className="size-3.5" />}
            label="Interesses"
            options={INTEREST_OPTIONS}
            values={form.interests}
            onToggle={(v) =>
              setForm((f) => ({
                ...f,
                interests: toggleInArray(f.interests, v),
              }))
            }
          />

          <TagPicker
            icon={<Salad className="size-3.5" />}
            label="Restrições alimentares"
            options={DIETARY_OPTIONS}
            values={form.dietary_preferences}
            onToggle={(v) =>
              setForm((f) => ({
                ...f,
                dietary_preferences: toggleInArray(f.dietary_preferences, v),
              }))
            }
          />

          <TagPicker
            icon={<Accessibility className="size-3.5" />}
            label="Acessibilidade"
            options={ACCESSIBILITY_OPTIONS}
            values={form.accessibility_needs}
            onToggle={(v) =>
              setForm((f) => ({
                ...f,
                accessibility_needs: toggleInArray(f.accessibility_needs, v),
              }))
            }
          />

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
          Preferencias atualizadas com sucesso!
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
      <p className="text-sm text-neutral-800 font-medium pl-0.5">{children}</p>
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

function TagPicker({
  icon,
  label,
  options,
  values,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  options: { label: string; value: string }[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">
        {icon}
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = values.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={
                active
                  ? "px-3 py-1.5 rounded-full text-xs font-medium border border-blue-500 bg-blue-500 text-white transition-colors"
                  : "px-3 py-1.5 rounded-full text-xs font-medium border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 transition-colors"
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
