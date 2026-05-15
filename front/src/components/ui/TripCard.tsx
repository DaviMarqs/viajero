export default function TripCard() {
  return (
    <div className="border border-neutral-300 rounded-2xl w-104 overflow-clip">
      <img
        src="{path}"
        alt="{title}"
        className="w-full mb-4"
      />
      <div className="px-4 pb-4 flex flex-col gap-2">
        <h2 className="font-semibold text-2xl">{title}</h2>
        <div className="flex gap-2">
          <p className="text-md">{budget}</p>
          <p>•</p>
          <p className="text-md">{duration}</p>
        </div>
        <div>
          <p className="text-md">{description}</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-blue-700 text-white w-full px-8 py-3 rounded-lg">
            Ver roteiro
          </button>
          <button className="bg-neutral-100 text-neutral-950 w-full px-8 py-3 border border-neutral-300 rounded-lg">
            Mais detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
