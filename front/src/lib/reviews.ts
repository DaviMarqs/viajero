import { apiRequest, unwrapListResponse } from "./api";
import type { Review } from "@/types/travel";

export interface ReviewInput {
  rating: number;
  title: string;
  body: string;
}

export async function listReviews(itineraryId: number | string, signal?: AbortSignal) {
  const payload = await apiRequest<{ data?: Review[]; }>("/api/reviews/", { signal }, { itinerary: itineraryId });
  return unwrapListResponse<Review>(payload);
}

export async function createReview(itineraryId: number | string, input: ReviewInput) {
  const payload = await apiRequest<{ data: Review; }>("/api/reviews/", {
    method: "POST",
    body: JSON.stringify({ itinerary: Number(itineraryId), ...input }),
  });
  return payload.data;
}

export async function updateReview(reviewId: number, input: ReviewInput) {
  const payload = await apiRequest<{ data: Review; }>(`/api/reviews/${reviewId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload.data;
}

export async function deleteReview(reviewId: number) {
  await apiRequest(`/api/reviews/${reviewId}/`, { method: "DELETE" });
}
