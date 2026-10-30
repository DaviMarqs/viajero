import { Dot } from "lucide-react";
import { Link } from "react-router-dom";

export default function TripRecomendation() {
  return (
    <div className="flex flex-col bg-canvas sm:flex-row border border-line rounded-lg overflow-clip w-full">
      <div className="w-full h-48 sm:w-auto sm:h-auto flex-shrink-0 bg-canvas flex items-center justify-center">
        <img
          src="../src/assets/pic-trip.svg"
          className="w-full h-full object-cover rounded-lg"
          alt=""
        />
      </div>

      <div className="py-6 px-6 flex flex-col gap-1">
        <h2 className="text-2xl font-medium pb-2">Nome do destino</h2>
        <p className="text-sm text-neutral-600 px-2 py-2 border border-line rounded-lg w-fit bg-canvas">
          Combina com o seu perfil: Natureza, fotografias, viagem em casal
        </p>
        <div className="flex items-center pt-2 text-sm flex-wrap">
          <p>A partir de R$5.000,00</p>
          <Dot />
          <p>7 dias</p>
        </div>
        <p className="text-sm pt-2 text-neutral-600">Descrição sobre o destino</p>
        <div className="pt-4 gap-2 w-full flex flex-col sm:flex-row">
          <Link
            to="/"
            className="text-center text-sm text-white w-full px-6 py-3 rounded-lg bg-accent hover:bg-primary-hover transition-colors"
          >
            Gerar roteiro
          </Link>
          <Link
            to="/destinos/1"
            className="text-center text-sm text-neutral-700 w-full px-6 py-3 rounded-lg border border-line"
          >
            Ver detalhes
          </Link>
        </div>
      </div>
    </div>
  );
}
