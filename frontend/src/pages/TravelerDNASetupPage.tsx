import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { viajeroApi } from "../api/viajero";
import { HomeIndicator, IconBed, IconBuilding, IconList, MobilePage, OptionCard, PrimaryButton, ScreenHeader } from "../components/ui/ViajeroUI";
import { useSession } from "../hooks/useSession";

const options = [
  { value: "essencial", title: "Essencial", description: "Apenas o essencial, focando na simplicidade.", icon: <IconList size={32} /> },
  { value: "intermediario", title: "Intermediário", description: "Equilíbrio entre custo e conveniência.", icon: <IconBuilding size={32} /> },
  { value: "luxo", title: "Luxo", description: "Experiência de luxo e serviços exclusivos.", icon: <IconBed size={32} /> },
];

export function TravelerDNASetupPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [selected, setSelected] = useState("luxo");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await viajeroApi.createTravelerDna(
      {
        travel_style: selected,
        pace: "moderado",
        comfort_level: selected,
        social_energy: 6,
        adventure_level: 7,
        food_focus: 8,
        cultural_interest: 9,
        nature_interest: 8,
        nightlife_interest: 4,
      },
      session.access,
    );
    navigate("/trip-preferences");
  }

  return (
    <MobilePage className="tight">
      <ScreenHeader title="Nível de Conforto" subtitle="O que é essencial para sua estadia?" backTo="/profile" skipTo="/" />
      <form className="stack" onSubmit={onSubmit}>
        <div className="option-list">
          {options.map((option) => (
            <OptionCard key={option.value} {...option} selected={selected === option.value} onClick={() => setSelected(option.value)} />
          ))}
        </div>
        <PrimaryButton type="submit">Próximo passo</PrimaryButton>
      </form>
      <HomeIndicator />
    </MobilePage>
  );
}
