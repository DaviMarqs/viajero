import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Breadcrumbs({ current }: { current: string; }) {
  return <nav aria-label="Localização" className="text-sm text-muted-foreground">
    <ol className="flex flex-wrap items-center gap-3">
      <li>
        <Link to="/" className="hover:text-primary">Home</Link>
      </li>
      <li aria-hidden="true">
        <ChevronRight className="size-4" />
      </li>
      <li aria-current="page" className="text-foreground">{current}
      </li>
    </ol>
  </nav>;
}
