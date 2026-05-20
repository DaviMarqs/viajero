import { Sun } from "lucide-react";

export default function Weather() {
  return (
    <div className="py-8 flex flex-col border border-neutral-300 rounded-2xl">
      <h2 className="px-8">Clima e previsão do tempo</h2>
      <div className="py-8 px-8 w-full">
        <div className="border border-neutral-300 rounded-2xl">
          <div className="px-4 py-4 flex flex-row">
            <Sun className="stroke-yellow-400 w-10 h-10" />
            <div className="px-3 flex flex-col">
              <h2 className="text-3xl">32°C</h2>
              <p>Ensolarado, sem chuva prevista</p>
            </div>
          </div>
          <div className="px-4 py-4">
            <p>Umidade 74%</p>
            <p>UV índice 9 — Alto</p>
            <p>Vento 18 km/h</p>
          </div>
        </div>
        <h2 className="pt-8 pb-8 font-semibold">Custos estimados</h2>
        <div className="p-4 border border-neutral-300 rounded-2xl p-4">
          <div className="flex justify-between py-1">
            <p>Passeios e entradas</p>
            <p className="font-semibold">R$160</p>
          </div>
          <div className="flex justify-between py-1">
            <p>Alimentação</p>
            <p className="font-semibold">R$225</p>
          </div>
          <div className="flex justify-between py-1">
            <p>Transporte</p>
            <p className="font-semibold">R$32</p>
          </div>

          <div className="border-t border-neutral-300 mt-2 pt-2 flex justify-between">
            <p className="font-semibold">Total estimado</p>
            <p className="font-semibold">R$420</p>
          </div>
        </div>
      </div>
    </div>
  );
}