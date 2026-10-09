import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Feedback } from "@/components/ui/feedback";
import { StarRating } from "@/components/ui/star-rating";
import { useAuth } from "@/contexts/authContext";
import { useReviews } from "@/hooks/useReviews";
import type { ReviewInput } from "@/lib/reviews";
import { formatRating } from "@/lib/utils";
import type { Itinerary } from "@/types/travel";
import { ReviewForm } from "./review-form";
import { ReviewItem, ReviewList } from "./review-list";

/** `onChanged` recarrega o roteiro para refletir média e total atualizados. */
export function ReviewsSection({ itinerary, onChanged }: { itinerary: Itinerary; onChanged: () => void; }) {
  const { user } = useAuth();
  const { reviews, loading, error, refetch, saving, saveError, clearSaveError, create, update, remove } = useReviews(itinerary.id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mine = user ? reviews.find(review => review.user.id === user.id) : undefined;
  const others = reviews.filter(review => review !== mine);
  const count = Number(itinerary.review_stats?.review_count ?? 0);
  const average = Number(itinerary.review_stats?.average_rating ?? 0);
  const canReview = itinerary.generation_status === "ready";

  async function handleCreate(input: ReviewInput) {
    const ok = await create(input);
    if (ok) onChanged();
    return ok;
  }

  async function handleUpdate(input: ReviewInput) {
    if (!mine) return false;
    const ok = await update(mine.id, input);
    if (ok) {
      setEditing(false);
      onChanged();
    }
    return ok;
  }

  async function handleDelete() {
    if (!mine) return;
    const ok = await remove(mine.id);
    setConfirmDelete(false);
    if (ok) onChanged();
  }

  return <section id="avaliacoes" aria-labelledby="avaliacoes-title" className="scroll-mt-24 space-y-6">
    <div className="space-y-2 border-b border-border pb-4">
      <h2 id="avaliacoes-title" className="section-title">Avaliações</h2>
      {count > 0 ? <p className="flex flex-wrap items-center gap-2 text-sm text-strong">
        <StarRating value={average} size="md" />
        <span className="font-medium">{formatRating(average)}</span>
        <span className="text-muted-foreground">({count} {count === 1 ? "avaliação" : "avaliações"})</span>
      </p> : <p className="text-sm text-muted-foreground">Este roteiro ainda não tem avaliações.</p>}
    </div>

    {loading ? <Feedback kind="loading" title="Carregando avaliações…" /> : error ? <Feedback kind="error" title="Não conseguimos carregar as avaliações" description={error} onRetry={refetch} /> : <>
      {canReview ? <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
        <h3 className="mb-4 text-lg">{mine ? "Sua avaliação" : count === 0 ? "Seja o primeiro a avaliar" : "Deixe sua avaliação"}</h3>
        {mine && !editing
          ? <ReviewItem review={mine} mine onEdit={() => { clearSaveError(); setEditing(true); }} onDelete={() => { clearSaveError(); setConfirmDelete(true); }} />
          : <ReviewForm
            key={mine ? `edit-${mine.id}` : "new"}
            isOwner={Boolean(itinerary.is_owner)}
            saving={saving}
            serverError={saveError}
            initial={mine ? { rating: mine.rating, title: mine.title, body: mine.body } : undefined}
            onSubmit={mine ? handleUpdate : handleCreate}
            onCancel={mine ? () => setEditing(false) : undefined}
          />}
        {mine && !editing && saveError && <p role="alert" className="mt-3 text-sm text-destructive">{saveError}</p>}
      </div> : <p className="text-sm text-muted-foreground">A avaliação fica disponível quando o roteiro estiver pronto.</p>}

      {others.length > 0 && <div className="space-y-2">
        <h3 className="text-lg">{mine ? "Outras avaliações" : "O que os viajantes dizem"}</h3>
        <ReviewList reviews={others} />
      </div>}
    </>}

    <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir sua avaliação?</DialogTitle>
          <DialogDescription>Essa ação não pode ser desfeita. A nota média do roteiro será recalculada.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? "Excluindo…" : "Excluir avaliação"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
