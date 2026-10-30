import type { ReactNode } from "react";

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="definition-list">{items.map(item => <div key={item.label} className="definition-row">
    <dt>{item.label}</dt><dd>{item.value == null || item.value === "" ? "Não informado" : item.value}</dd>
  </div>)}</dl>;
}
