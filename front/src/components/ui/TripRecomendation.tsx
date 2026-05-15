export default function TripRecomendation() {
  return (
    <div className="flex border border-neutral-300 rounded-2xl overflow-clip">
      <img src="../src/assets/pic-trip.svg" className="" alt="" />
      <div className="py-8">
        <h2>Nome do destino</h2>
        <p>details</p>
        <div className="flex">
          <p>5000.0$</p>
          <p>dias</p>
        </div>
        <p>Description</p>
        <div className="Flex">
          <button>Ver roteiro</button>
          <button>Ver detalhes</button>
        </div>
      </div>
    </div>
  );
}
