import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/authContext";
import { useDestinations } from "@/hooks/useDestinations";
import { usePois } from "@/hooks/usePois";
import DestinationInfo from "@/components/ui/info";
import PoiList from "@/components/ui/poi-list";

export default function DestinationPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { token } = useAuth();
  const destinationId = id ? parseInt(id) : null;
  const { pois, loading: poisLoading } = usePois(token, destinationId);
  const { destination, loading } = useDestinations(token, id!);

  console.log("PARAM ID", id);
  console.log("DESTINATION ID", destinationId);

  if (loading) return <div>Carregando...</div>;
  if (!destination) return <div>Destino não encontrado</div>;
  return (
    <section className="px-6 py-6 lg:px-8">
      <button
        type="button"
        className="mb-4 px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium transition"
        onClick={() => navigate(-1)}
      >
        ← Voltar
      </button>
      <img
        src={destination.hero_image_url}
        alt={destination.name}
        className="w-full max-h-96 object-cover rounded-3xl lg:h-96"
      />
      <div className="flex flex-col gap-8">
        <div className="py-4 border-b border-neutral-300">
          <h2 className="text-3xl font-bold">{destination.name}</h2>
          <p className="text-lg text-gray-600">
            {destination.city}, {destination.country}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Sobre o destino</h2>
          <p className="text-sm text-gray-600">{destination.summary}</p>
        </div>

        <div>
          <DestinationInfo destination={destination} />
        </div>

        <div>
          <PoiList pois={pois} loading={poisLoading} />
        </div>
      </div>
    </section>
  );
}
