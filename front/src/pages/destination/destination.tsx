import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Star, Clock, Globe, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/authContext'
import { useDestinations } from '@/hooks/useDestinations'
import { createReview } from '@/lib/reviews'

const seasonLabel: Record<string, string> = {
  spring: 'Primavera',
  summer: 'Verão',
  autumn: 'Outono',
  fall: 'Outono',
  winter: 'Inverno',
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
        >
          <Star
            className={`size-7 transition-colors ${
              star <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-neutral-300'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export default function DestinationPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { destination, loading, error } = useDestinations(token, slug ?? '')

  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!rating || !title || !body) return

    setSubmitting(true)
    setReviewError(null)

    try {
      // Review precisa de um itinerary_id — por ora usamos 1 como placeholder
      // Quando tiver a página de itinerary, passa o id correto
      await createReview(token, { itinerary: 1, rating, title, body })
      setReviewSuccess(true)
      setRating(0)
      setTitle('')
      setBody('')
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Erro ao enviar review')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-400 text-sm">Carregando destino...</p>
      </div>
    )
  }

  if (error || !destination) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-neutral-500 text-sm">Destino não encontrado.</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm hover:underline">
          Voltar
        </button>
      </div>
    )
  }

  const rating_num = Number(destination.average_rating)
  const imageUrl = destination.hero_image_url || `https://picsum.photos/seed/${destination.id}/800/400`
  const season = seasonLabel[destination.best_season.toLowerCase()] ?? destination.best_season

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-56 sm:h-72 md:h-96 bg-neutral-200">
        <img
          src={imageUrl}
          alt={destination.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Botão voltar */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex items-center justify-center size-9 bg-white/90 rounded-full shadow-sm hover:bg-white transition-colors"
        >
          <ArrowLeft className="size-4 text-neutral-700" />
        </button>

        {/* Título sobre a imagem */}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-white text-2xl sm:text-3xl font-bold leading-tight">
            {destination.name}
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin className="size-3.5 text-white/80 shrink-0" />
            <p className="text-white/80 text-sm">{destination.city}, {destination.country}</p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {rating_num > 0 && (
            <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {rating_num.toFixed(1)}
            </span>
          )}
          <span className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full capitalize">
            {season}
          </span>
          {destination.cost_profile && (
            <span className="bg-neutral-100 text-neutral-600 text-xs font-medium px-3 py-1.5 rounded-full">
              {destination.cost_profile}
            </span>
          )}
        </div>

        {/* Sobre */}
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-neutral-900">Sobre o destino</h2>
          <p className="text-sm text-neutral-600 leading-relaxed">{destination.summary}</p>
        </div>

        {/* Infos rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-3 bg-neutral-50 rounded-2xl p-4">
            <Clock className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-neutral-400">Fuso horário</p>
              <p className="text-sm font-medium text-neutral-800 mt-0.5">{destination.timezone}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-neutral-50 rounded-2xl p-4">
            <Globe className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-neutral-400">Melhor época</p>
              <p className="text-sm font-medium text-neutral-800 mt-0.5">{season}</p>
            </div>
          </div>
        </div>

        {/* CTA criar roteiro */}
        <button
          onClick={() => navigate('/onboard')}
          className="flex items-center justify-between w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-4 rounded-2xl transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-semibold">Criar roteiro para {destination.name}</p>
            <p className="text-xs text-blue-200 mt-0.5">A IA monta seu itinerário completo</p>
          </div>
          <ChevronRight className="size-5 shrink-0" />
        </button>

        {/* Divider */}
        <div className="border-t border-neutral-100" />

        {/* Review form */}
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-neutral-900">Deixar uma avaliação</h2>

          {reviewSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700">
              Avaliação enviada com sucesso!
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-neutral-500">Sua nota</p>
                <StarRating value={rating} onChange={setRating} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-neutral-500" htmlFor="review-title">
                  Título
                </label>
                <input
                  id="review-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Resumo da sua experiência"
                  className="h-11 px-4 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder:text-neutral-400"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-neutral-500" htmlFor="review-body">
                  Descrição
                </label>
                <textarea
                  id="review-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Conte como foi sua viagem..."
                  rows={4}
                  className="px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:bg-white transition-colors resize-none placeholder:text-neutral-400"
                />
              </div>

              {reviewError && (
                <p className="text-sm text-red-500">{reviewError}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !rating || !title || !body}
                className="h-12 w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {submitting ? 'Enviando...' : 'Enviar avaliação'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}