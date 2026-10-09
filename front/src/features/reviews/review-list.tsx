import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import type { Review } from "@/types/travel";

function formatReviewDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function wasEdited(review: Review) {
  return new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 1000;
}

export function ReviewItem({ review, mine = false, onEdit, onDelete }: {
  review: Review;
  mine?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const name = review.user.display_name || "Viajante";
  return <article className="space-y-3 py-5" aria-label={`Avaliação de ${mine ? "você" : name}`}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-primary">
          {review.user.avatar_url ? <img src={review.user.avatar_url} alt="" className="size-full object-cover" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{mine ? `${name} (você)` : name}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={review.created_at}>{formatReviewDate(review.created_at)}</time>{wasEdited(review) && " · editada"}
          </p>
        </div>
      </div>
      <StarRating value={review.rating} />
    </header>
    {review.title && <h4 className="text-base">{review.title}</h4>}
    {review.body && <p className="max-w-[65ch] whitespace-pre-line text-sm leading-6 text-strong">{review.body}</p>}
    {mine && (onEdit || onDelete) && <div className="flex flex-wrap gap-2">
      {onEdit && <Button variant="outline" onClick={onEdit}><Pencil aria-hidden="true" />Editar</Button>}
      {onDelete && <Button variant="destructive" onClick={onDelete}><Trash2 aria-hidden="true" />Excluir</Button>}
    </div>}
  </article>;
}

export function ReviewList({ reviews }: { reviews: Review[]; }) {
  return <ul className="divide-y divide-border">
    {reviews.map(review => <li key={review.id}><ReviewItem review={review} /></li>)}
  </ul>;
}
