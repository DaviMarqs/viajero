import { Dot } from "lucide-react";

export default function TripRecomendation() {
  return (
    <div className="flex border border-neutral-300 rounded-2xl overflow-clip w-full">
      <img src="../src/assets/pic-trip.svg" className="" alt="" />
      <div className="py-8 p-6">
        <h2 className="pb-2 text-3xl">Nome do destino</h2>
        <p className="pt-2 border px-2 py-2 border-neutral-300 bg-neutral-100 rounded-lg">Combina com o seu perfil: Natureza, fotografias, viagem em casal</p>
        <div className="pt-2 flex">
          <p>A partir de R$5.000,00</p>
          <p><Dot /></p>
          <p>7 dias</p>
        </div>
        <p className="pt-2">Descrição sobre o destino</p>
        <div className="pt-2 gap-2 w-full flex">
          <button className=" bg-blue-700 text-white w-full px-8 py-3 rounded-lg">
            Ver roteiro
          </button>
          <button className=" bg-neutral-100 text-neutral-950 w-full px-8 py-3 border border-neutral-300 rounded-lg">
            Mais detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
