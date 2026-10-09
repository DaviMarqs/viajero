import { useCallback, useState } from "react";
import { createReview, deleteReview, listReviews, updateReview, type ReviewInput } from "@/lib/reviews";
import type { Review } from "@/types/travel";
import { useAsyncResource } from "./useAsyncResource";

export function useReviews(itineraryId: number | string) {
  const load = useCallback((signal: AbortSignal) => listReviews(itineraryId, signal), [itineraryId]);
  const { data: reviews, loading, error, refetch, setData } = useAsyncResource<Review[]>(load, []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Aplica o resultado da mutação na lista local: recarregar trocaria a seção pelo estado de carregamento.
  async function run<T>(operation: () => Promise<T>, apply: (result: T) => Review[]) {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await operation();
      setData(apply(result));
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
    create: (input: ReviewInput) => run(() => createReview(itineraryId, input), created => [created, ...reviews]),
    update: (reviewId: number, input: ReviewInput) =>
      run(() => updateReview(reviewId, input), updated => reviews.map(review => (review.id === updated.id ? updated : review))),
    remove: (reviewId: number) => run(() => deleteReview(reviewId), () => reviews.filter(review => review.id !== reviewId)),
  };
}
