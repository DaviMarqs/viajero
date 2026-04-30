import { PropsWithChildren } from "react";

export function Card({ children }: PropsWithChildren) {
  return <article className="card">{children}</article>;
}

