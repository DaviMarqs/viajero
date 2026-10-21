import { DefinitionList } from "./definition-list";
import { Sun, Clock, Globe, Star, DollarSign } from "lucide-react";
import type { Destination } from "@/lib/destinations";
import { useMoney } from "@/contexts/currencyContext";

const seasonLabel: Record<string, string> = {
  spring: "Primavera",
  summer: "Verão",
  autumn: "Outono",
  fall: "Outono",
  winter: "Inverno",
};

interface DestinationInfoProps {
  destination: Destination;
}

function getCostLabel(
  destination: Destination,
  money: ReturnType<typeof useMoney>["money"],
) {
  const costProfile = destination.cost_profile;

  if (!costProfile) return null;

  if (typeof costProfile === "string" || typeof costProfile === "number") {
    return String(costProfile);
  }

  if (typeof costProfile === "object") {
    const profile = costProfile as {
      currency_code?: unknown;
      daily_budget_mid?: unknown;
    };
    const currencyCode =
      typeof profile.currency_code === "string" ? profile.currency_code : "";
    const dailyBudgetMid = Number(profile.daily_budget_mid);

    if (Number.isFinite(dailyBudgetMid) && dailyBudgetMid > 0) {
      return `${money(dailyBudgetMid, currencyCode || "BRL")}/dia`;
    }
  }

  return null;
}

export default function DestinationInfo({ destination }: DestinationInfoProps) {
  const { money } = useMoney();
  const bestSeason = destination.best_season ?? "";
  const season = seasonLabel[bestSeason.toLowerCase()] ?? bestSeason;
  const ratingNum = Number(destination.average_rating);
  const costLabel = getCostLabel(destination, money);

  const items = [
    {
      label: "Melhor época para visitar",
      value: season,
      icon: <Sun className="size-4" />,
    },
    {
      label: "Fuso horário",
      value: destination.timezone,
      icon: <Clock className="size-4" />,
    },
    {
      label: "Localização",
      value: `${destination.name}, ${destination.country}`,
      icon: <Globe className="size-4" />,
    },
    ...(ratingNum > 0
      ? [
          {
            label: "Avaliação",
            value: `${ratingNum.toFixed(1)} / 5.0`,
            icon: <Star className="size-4" />,
          },
        ]
      : []),
    ...(costLabel
      ? [
          {
            label: "Custo",
            value: costLabel,
            icon: <DollarSign className="size-4" />,
          },
        ]
      : []),
  ];

  return <section className="flex flex-col gap-4">
    <h2 className="section-title">Informações</h2>
    <DefinitionList items={items.slice(0, 2)} />
  </section>;
}
