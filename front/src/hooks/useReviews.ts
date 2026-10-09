import { useCallback, useState } from "react";
import { createReview, deleteReview, listReviews, updateReview, type ReviewInput } from "@/lib/reviews";
import type { Review } from "@/types/travel";
import { useAsyncResource } from "./useAsyncResource";

export function useReviews(itineraryId: number | string) {
  const load = useCallback((signal: AbortSignal) => listReviews(itineraryId, signal), [itineraryId]);
  const { data: reviews, loading, error, refetch } = useAsyncResource<Review[]>(load, []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function run(operation: () => Promise<unknown>) {
    setSaving(true);
    setSaveError(null);
    try {
      await operation();
      refetch();
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar a avaliação.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    reviews,
    loading,
    error,
    refetch,
    saving,
    saveError,
    clearSaveError: () => setSaveError(null),
    create: (input: ReviewInput) => run(() => createReview(itineraryId, input)),
    update: (reviewId: number, input: ReviewInput) => run(() => updateReview(reviewId, input)),
    remove: (reviewId: number) => run(() => deleteReview(reviewId)),
  };
}
