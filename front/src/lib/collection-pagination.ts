export function collectionPagination(positions: number[], scrollLeft: number) {
  const maximum = positions[positions.length - 1] ?? 0;
  const count = Math.min(5, positions.length);
  if (maximum <= 2 || count < 2) return { indexes: [0], active: 0 };

  const indexes = Array.from({ length: count }, (_, index) => {
    const threshold = maximum * index / (count - 1);
    return positions.findIndex(position => position >= threshold);
  });
  const progress = Math.max(0, Math.min(1, scrollLeft / maximum));
  const active = scrollLeft >= maximum - 2 ? count - 1 : Math.floor(progress * (count - 1));
  return { indexes, active };
}
