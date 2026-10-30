import { Review } from './entities';

export interface PresentedReview {
  id: number;
  itinerary: number;
  rating: number;
  title: string;
  body: string;
  created_at: Date;
  updated_at: Date;
  user: { id: number; display_name: string; avatar_url: string };
}

/** Avaliacoes sao publicas: o autor sai reduzido (nunca senha, email ou flags). Requer relations user + itinerary. */
export function presentReview(review: Review): PresentedReview {
  const author = review.user;
  return {
    id: Number(review.id),
    itinerary: Number(review.itinerary.id),
    rating: review.rating,
    title: review.title,
    body: review.body,
    created_at: review.created_at,
    updated_at: review.updated_at,
    user: {
      id: Number(author.id),
      display_name: author.display_name || author.first_name || author.username,
      avatar_url: author.avatar_url,
    },
  };
}
