import { useCallback, useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { apiRequest, type ApiSuccessResponse } from "@/lib/api";

export function FavoriteItineraryButton({
  itineraryId,
  initialFavoriteId,
  onRemoved,
  compact = false,
}: {
  itineraryId: number | string;
  initialFavoriteId?: number | string;
  onRemoved?: () => void;
  compact?: boolean;
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const response = await apiRequest<
        ApiSuccessResponse<{ id: number | string; itinerary: { id: number | string } }[]>
      >("/api/favorites/", { signal });
      return (response.data ?? []).find(
        (item) => String(item.itinerary.id) === String(itineraryId),
      )?.id ?? null;
    },
    [itineraryId],
  );
  const favorite = useAsyncResource(load, initialFavoriteId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save() {
    if (saving || favorite.loading) return;
    setSaving(true);
    setError("");
    try {
      if (favorite.data !== null) {
        await apiRequest(`/api/favorites/${favorite.data}/`, { method: "DELETE" });
        favorite.setData(null);
        setMessage("Roteiro removido dos favoritos.");
        onRemoved?.();
      } else {
        const response = await apiRequest<ApiSuccessResponse<{ id: number | string }>>("/api/favorites/", {
          method: "POST", body: JSON.stringify({ itinerary: Number(itineraryId) }),
        });
        if (response.data?.id == null) throw new Error("Não foi possível confirmar o favorito. Tente novamente.");
        favorite.setData(response.data.id);
        setMessage("Roteiro adicionado aos favoritos.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível atualizar os favoritos.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="action-control">
      <Button
        variant="outline"
        size={compact ? "icon" : "default"}
        disabled={saving || favorite.loading}
        onClick={favorite.error ? favorite.refetch : save}
        aria-pressed={favorite.data !== null}
        aria-label={favorite.data !== null ? "Desfavoritar roteiro" : "Favoritar roteiro"}
      >
        {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Heart
          aria-hidden="true"
          className={favorite.data !== null ? "fill-current text-destructive" : ""}
        />}
        {!compact && (favorite.data !== null
          ? saving ? "Removendo…" : "Desfavoritar roteiro"
          : saving
            ? "Salvando…"
            : favorite.error
              ? "Tentar carregar favoritos"
              : "Favoritar roteiro")}
      </Button>
      {error && (
        <p role="alert" className="max-w-64 text-sm text-destructive">
          {error}
        </p>
      )}
      <span role="status" className="sr-only">{message}</span>
    </div>
  );
}
