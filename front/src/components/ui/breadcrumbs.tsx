import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Breadcrumbs({ current, parent }: { current: string; parent?: { label: string; to: string } }) {
  return <nav aria-label="Localização" className="text-sm text-muted-foreground">
    <ol className="flex flex-wrap items-center gap-3">
      <li>
        <Link to="/" className="hover:text-foreground">Início</Link>
      </li>
      <li aria-hidden="true">
        <ChevronRight className="size-4" />
      </li>
      {parent && <><li><Link to={parent.to} className="hover:text-foreground">{parent.label}</Link></li><li aria-hidden="true"><ChevronRight className="size-4" /></li></>}
      <li aria-current="page" className="text-foreground">{current}
      </li>
    </ol>
  </nav>;
}
