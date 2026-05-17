import { Lightbulb } from "lucide-react";

export default function RoadTrip() {
  return (
    <div className="flex border border-neutral-300 rounded-2xl overflow-clip w-full">
      <div>
        <img src="../src/assets/pic-tripb.svg" className="rounded-2xl" alt="" />
      </div>
      <div className="flex-col py-6 px-6">
        <div className="flex w-full pt-6">
          <h2 className="text-3xl">Programação</h2>
          <p className="py-2 px-12 text-blue-600 font-bold">13:37</p>
        </div>
        <div className="pt-2">
          <p>Detalhes da programação do horário</p>
        </div>
        <div className="pt-2">
          <p>Custo estimado: R$50,00</p>
        </div>
        <div className="pt-4">
          <div className="pt-2 border px-2 py-2 border-neutral-300 bg-amber-100 rounded-lg">
            <p className="py-2 px-2 flex gap-2 text-amber-900">
              <Lightbulb />
              Dica: Exiba uma mensagem de dica ao usuário
            </p>
          </div>
        </div>
        <div className="pt-4">
          <button className=" bg-neutral-100 text-neutral-950 w-full px-8 py-3 border border-neutral-300 rounded-lg">
            Ver detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
