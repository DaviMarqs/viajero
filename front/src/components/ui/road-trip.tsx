import { Lightbulb } from "lucide-react";

export default function RoadTrip() {
  return (
    <div className="flex flex-col sm:flex-row border border-neutral-300 rounded-2xl overflow-clip w-full">
      <div className="w-full h-48 sm:w-48 sm:h-auto flex-shrink-0">
        <img
          src="../src/assets/pic-tripb.svg"
          className="w-full h-full object-cover"
          alt=""
        />
      </div>

      <div className="flex flex-col py-5 px-5 gap-2 w-full">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-2xl">Programação</h2>
          <p className="text-blue-600 font-bold">13:37</p>
        </div>

        <p className="text-sm text-neutral-700">
          Detalhes da programação do horário
        </p>

        <p className="text-sm text-neutral-700">Custo estimado: R$50,00</p>

        <div className="border px-3 py-2 border-neutral-300 bg-amber-100 rounded-lg">
          <p className="flex gap-2 items-start text-sm text-amber-900">
            <Lightbulb className="flex-shrink-0 mt-0.5" size={16} />
            Dica: Exiba uma mensagem de dica ao usuário
          </p>
        </div>

        <button className="bg-neutral-100 text-neutral-950 w-full px-6 py-2.5 border border-neutral-300 rounded-lg text-sm mt-1">
          Ver detalhes
        </button>
      </div>
    </div>
  );
}