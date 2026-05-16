import { Sun } from "lucide-react";

export default function Weather() {
  return (
    <div className="pt-8 flex flex-col border  border-neutral-300 items-center justify-content rounded-2xl">
      <h2>Clima e previsao do tempo</h2>
      <div className="py-8 px-8">
        <div className="border border-neutral-300 rounded-2xl">
          <div className="pt-8 flex flex-row">
            <Sun ""/>

            <div className="flex flex-col">
              <h2> 32°C</h2>
              <p>ensolarado</p>
            </div>
          </div>
          <div><p>Umidade 74%</p>
          <p>UV índice 9 — Alto</p>
          <p>Vento 18 km/h</p></div>
          <div></div>
        </div>
        <h2 className="pt-8">Custo estimados</h2>
        <div className="pt-8">
          <div className="border border-neutral-300 rounded-2xl">
            <p>Passeios e entradas</p>
          </div>
          <div className="border border-neutral-300 rounded-2xl">
            <p>Total estimado: R$ 1.200,00</p>
          </div>
        </div>
      </div>
    </div>
  );
}
