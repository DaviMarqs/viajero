"use client";

import { useState, useRef } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/authContext";
import { TripPreferencesSection } from "./trip-preferences-section";
import { TravelerDNASection } from "./traveler-dna-section";
import {
  User,
  Mail,
  AtSign,
  Plane,
  DollarSign,
  Camera,
  Check,
  X,
  Pencil,
  LogOut,
  AlertCircle,
  Loader2,
} from "lucide-react";

const CURRENCY_OPTIONS = [
  { value: "BRL", label: "Real (BRL)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "Libra (GBP)" },
  { value: "ARS", label: "Peso Arg. (ARS)" },
];

interface FieldProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  editing: boolean;
  inputNode: React.ReactNode;
}

function Field({ label, value, icon, editing, inputNode }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">
        <span className="text-neutral-400">{icon}</span>
        {label}
      </label>
      {editing ? (
        inputNode
      ) : (
        <p className="text-sm text-neutral-800 font-medium pl-0.5">
          {value || <span className="text-neutral-400 font-normal">—</span>}
        </p>
      )}
    </div>
  );
}

interface ProfilePageProps {
  token: string;
  onLogout: () => void;
}

export default function ProfilePage({ token, onLogout }: ProfilePageProps) {
  const { user, loading, error, refetch, saveGuestProfile } = useUserProfile(token);
  const { isGuest, refreshUser } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSuccess] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    display_name: "",
    first_name: "",
    last_name: "",
    home_airport: "",
    preferred_currency: "",
  });

  function startEditing() {
    if (!user) return;
    setForm({
      display_name: user.display_name ?? "",
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      home_airport: user.home_airport ?? "",
      preferred_currency: user.preferred_currency ?? "",
    });
    setSaveError(null);
    setSuccess(false);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    if (!token) {
      saveGuestProfile(form);
      refreshUser();
      setSuccess(true);
      setEditing(false);
      setSaving(false);
      setTimeout(() => setSuccess(false), 3000);
      return;
    }

    try {
      await apiRequest("/api/users/me/", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      setSuccess(true);
      setEditing(false);

      refetch();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      setSaveError("Upload de avatar esta desativado no modo sem login.");
      return;
    }

    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      await apiRequest("/api/users/me/avatar/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      refetch();
    } catch {
      alert("Erro ao enviar avatar. Tente novamente.");
    } finally {
      setAvatarUploading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-400">Carregando perfil…</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <AlertCircle className="size-6 text-red-400" />
          <p className="text-sm text-neutral-500">
            {error ?? "Usuário não encontrado."}
          </p>
        </div>
      </div>
    );
  }

  const initials =
    [user.first_name?.[0], user.last_name?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user.display_name?.[0]?.toUpperCase() ||
    "?";

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-semibold text-neutral-900">Meu perfil</h1>
        <button
          onClick={onLogout}
          disabled={isGuest}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="size-20 rounded-full bg-blue-50 border border-blue-100 overflow-hidden flex items-center justify-center">
              {avatarUploading ? (
                <Loader2 className="size-5 animate-spin text-blue-400" />
              ) : user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-blue-500">
                  {initials}
                </span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isGuest}
              className="absolute -bottom-1 -right-1 size-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors shadow-sm"
              title="Alterar foto"
            >
              <Camera className="size-3.5 text-neutral-500" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-lg font-semibold text-neutral-900 truncate">
              {user.display_name ||
                `${user.first_name} ${user.last_name}`.trim() ||
                "—"}
            </p>
            <p className="text-sm text-neutral-400 truncate">{user.email}</p>
            {!user.is_profile_complete && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-0.5 w-fit">
                <AlertCircle className="size-3" />
                Perfil incompleto
              </span>
            )}
          </div>

          {!editing && (
            <button
              onClick={startEditing}
              className="ml-auto shrink-0 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Pencil className="size-3.5" />
              Editar
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-neutral-700">
            Informações pessoais
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="Nome"
              value={user.first_name}
              icon={<User className="size-3.5" />}
              editing={editing}
              inputNode={
                <input
                  className={inputClass}
                  value={form.first_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                  placeholder="Nome"
                />
              }
            />
            <Field
              label="Sobrenome"
              value={user.last_name}
              icon={<User className="size-3.5" />}
              editing={editing}
              inputNode={
                <input
                  className={inputClass}
                  value={form.last_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                  placeholder="Sobrenome"
                />
              }
            />
            <Field
              label="Nome de exibição"
              value={user.display_name}
              icon={<AtSign className="size-3.5" />}
              editing={editing}
              inputNode={
                <input
                  className={inputClass}
                  value={form.display_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, display_name: e.target.value }))
                  }
                  placeholder="Como quer ser chamado"
                />
              }
            />
            <Field
              label="E-mail"
              value={user.email ?? ""}
              icon={<Mail className="size-3.5" />}
              editing={false}
              inputNode={null}
            />
          </div>

          <div className="border-t border-neutral-100 pt-5 flex flex-col gap-5">
            <h2 className="text-sm font-semibold text-neutral-700">
              Preferências de viagem
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field
                label="Aeroporto de origem"
                value={user.home_airport ?? ""}
                icon={<Plane className="size-3.5" />}
                editing={editing}
                inputNode={
                  <input
                    className={inputClass}
                    value={form.home_airport}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        home_airport: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Ex: GRU"
                    maxLength={4}
                  />
                }
              />
              <Field
                label="Moeda preferida"
                value={
                  CURRENCY_OPTIONS.find(
                    (c) => c.value === user.preferred_currency,
                  )?.label ??
                  user.preferred_currency ??
                  ""
                }
                icon={<DollarSign className="size-3.5" />}
                editing={editing}
                inputNode={
                  <select
                    className={inputClass}
                    value={form.preferred_currency}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        preferred_currency: e.target.value,
                      }))
                    }
                  >
                    <option value="">Selecionar…</option>
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                }
              />
            </div>
          </div>

          {editing && (
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
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 border border-neutral-200 hover:bg-neutral-50 px-4 py-2 rounded-xl transition-colors"
              >
                <X className="size-4" />
                Cancelar
              </button>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle className="size-4 shrink-0" />
              {saveError}
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <Check className="size-4 shrink-0" />
              Perfil atualizado com sucesso!
            </div>
          )}

          {isGuest && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <AlertCircle className="size-4 shrink-0" />
              Modo visitante ativo. As alteracoes ficam salvas apenas neste navegador.
            </div>
          )}
        </div>

        {/* {token && <TripPreferencesSection token={token} />} */}
        {token && <TravelerDNASection token={token} />}

        <div className="bg-white rounded-2xl border border-neutral-100 px-6 py-4 flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-neutral-700 mb-2">Conta</h2>
          <div className="grid grid-cols-2 gap-y-2 text-xs text-neutral-400">
            <span>ID do usuário</span>
            <span className="text-right font-mono text-neutral-500">
              #{user.id}
            </span>
            <span>Membro desde</span>
            <span className="text-right text-neutral-500">
              {new Date(user.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span>Última atualização</span>
            <span className="text-right text-neutral-500">
              {new Date(user.updated_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
