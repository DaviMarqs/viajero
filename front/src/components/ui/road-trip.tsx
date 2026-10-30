import { Lightbulb } from "lucide-react";

export default function RoadTrip() {
  return (
    <div className="flex border border-line rounded-lg overflow-clip w-full">
      <div>
        <img src="../src/assets/pic-tripb.svg" className="rounded-lg" alt="" />
      </div>
      <div className="flex-col py-6 px-6">
        <div className="flex w-full pt-6">
          <h2 className="text-3xl">Programação</h2>
          <p className="py-2 px-12 text-ink-muted font-bold">13:37</p>
        </div>
        <div className="pt-2">
          <p>Detalhes da programação do horário</p>
        </div>
        <div className="pt-2">
          <p>Custo estimado: R$50,00</p>
        </div>
        <div className="pt-4">
          <div className="pt-2 border px-2 py-2 border-line bg-canvas rounded-lg">
            <p className="py-2 px-2 flex gap-2 text-ink-muted">
              <Lightbulb />
              Dica: Exiba uma mensagem de dica ao usuário
            </p>
          </div>
        </div>
        <div className="pt-4">
          <button className=" bg-canvas text-neutral-950 w-full px-8 py-3 border border-line rounded-lg">
            Ver detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
