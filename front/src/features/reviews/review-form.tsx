import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StarRatingInput } from "@/components/ui/star-rating";
import type { ReviewInput } from "@/lib/reviews";

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Escolha uma nota de 1 a 5.").max(5, "Escolha uma nota de 1 a 5."),
  title: z.string().trim().max(120, "Use no máximo 120 caracteres."),
  body: z.string().trim().max(2000, "Use no máximo 2000 caracteres."),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

export function ReviewForm({ initial, isOwner, saving, serverError, onSubmit, onCancel }: {
  initial?: ReviewInput;
  isOwner: boolean;
  saving: boolean;
  serverError: string | null;
  onSubmit: (values: ReviewInput) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: initial ?? { rating: 0, title: "", body: "" },
  });
  const editing = Boolean(initial);

  return <form className="space-y-5" noValidate onSubmit={handleSubmit(values => onSubmit(values))}>
    <Controller name="rating" control={control} render={({ field }) => <StarRatingInput
      name="review-rating"
      legend={isOwner ? "Como foi sua viagem?" : "Avalie este roteiro"}
      value={field.value}
      onChange={field.onChange}
      error={errors.rating?.message}
      disabled={saving}
    />} />
    <div className="space-y-2">
      <label htmlFor="review-title" className="text-sm font-medium text-strong">Título <span className="font-normal text-muted-foreground">(opcional)</span></label>
      <Input id="review-title" maxLength={120} placeholder="Resuma sua experiência" aria-invalid={!!errors.title} aria-describedby={errors.title ? "review-title-error" : undefined} disabled={saving} {...register("title")} />
      {errors.title && <p id="review-title-error" role="alert" className="text-sm text-destructive">{errors.title.message}</p>}
    </div>
    <div className="space-y-2">
      <label htmlFor="review-body" className="text-sm font-medium text-strong">Comentário <span className="font-normal text-muted-foreground">(opcional)</span></label>
      <textarea
        id="review-body"
        rows={4}
        maxLength={2000}
        placeholder="O que funcionou bem? O que você mudaria?"
        className="min-h-28 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        aria-invalid={!!errors.body}
        aria-describedby={errors.body ? "review-body-error" : undefined}
        disabled={saving}
        {...register("body")}
      />
      {errors.body && <p id="review-body-error" role="alert" className="text-sm text-destructive">{errors.body.message}</p>}
    </div>
    {isOwner && !editing && <p className="text-xs leading-5 text-muted-foreground">Ao avaliar, este roteiro passa a aparecer anonimamente no ranking de mais bem avaliados.</p>}
    {serverError && <p role="alert" className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">{serverError}</p>}
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={saving}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Publicar avaliação"}</Button>
      {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>}
    </div>
  </form>;
}
