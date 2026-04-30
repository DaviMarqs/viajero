export function LoadingState() {
  return <div className="state-card">Loading Viajero data...</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="state-card">{message}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-card error">{message}</div>;
}

