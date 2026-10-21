import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function TravelCard({ variant = "destination", className, ...props }: ComponentProps<"article"> & {
  variant?: "destination" | "itinerary" | "dna" | "metric";
}) {
  return <article {...props} data-card-variant={variant} className={cn("travel-card", className)} />;
}
