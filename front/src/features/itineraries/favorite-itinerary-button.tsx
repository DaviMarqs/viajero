import { useCallback, useState } from "react";
import { Heart } from "lucide-react";
import { useToast } from "@/components/motion/toast-context";
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
  const notify = useToast();
  async function save() {
    if (saving || favorite.loading) return;
    setSaving(true);
    setError("");
    try {
      if (favorite.data !== null) {
        await apiRequest(`/api/favorites/${favorite.data}/`, { method: "DELETE" });
        favorite.setData(null);
        notify({ title: "Roteiro removido dos favoritos.", action: { label: "Desfazer", onClick: async () => {
          try {
            const restored = await apiRequest<ApiSuccessResponse<{ id: number | string }>>("/api/favorites/", { method: "POST", body: JSON.stringify({ itinerary: Number(itineraryId) }) });
            if (restored.data?.id == null) throw new Error("N\u00e3o foi poss\u00edvel confirmar o favorito.");
            favorite.setData(restored.data.id); notify({ title: "Roteiro adicionado aos favoritos." });
          } catch (error) { notify({ title: error instanceof Error ? error.message : "N\u00e3o foi poss\u00edvel desfazer. Tente novamente." }); }
        } } });
        onRemoved?.();
      } else {
        const response = await apiRequest<ApiSuccessResponse<{ id: number | string }>>("/api/favorites/", {
          method: "POST", body: JSON.stringify({ itinerary: Number(itineraryId) }),
        });
        if (response.data?.id == null) throw new Error("Não foi possível confirmar o favorito. Tente novamente.");
        favorite.setData(response.data.id);
        const savedId = response.data.id;
        notify({ title: "Roteiro adicionado aos favoritos.", action: { label: "Desfazer", onClick: async () => {
          try { await apiRequest(`/api/favorites/${savedId}/`, { method: "DELETE" }); favorite.setData(null); onRemoved?.(); notify({ title: "Roteiro removido dos favoritos." }); }
          catch (error) { notify({ title: error instanceof Error ? error.message : "N\u00e3o foi poss\u00edvel desfazer. Tente novamente." }); }
        } } });
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
        loading={saving}
        disabled={favorite.loading}
        onClick={favorite.error ? favorite.refetch : save}
        aria-pressed={favorite.data !== null}
        aria-label={favorite.data !== null ? "Desfavoritar roteiro" : "Favoritar roteiro"}
      >
        <Heart aria-hidden="true" className={favorite.data !== null ? "favorite-heart fill-current" : "favorite-heart"} />
        {!compact && (favorite.error ? "Tentar carregar favoritos" : favorite.data !== null ? "Desfavoritar roteiro" : "Favoritar roteiro")}
      </Button>
      {error && (
        <p role="alert" className="max-w-64 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
