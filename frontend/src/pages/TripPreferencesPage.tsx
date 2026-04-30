import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { HomeIndicator, IconHeart, IconUser, IconUsers, MobilePage, OptionCard, PrimaryButton, ScreenHeader } from "../components/ui/ViajeroUI";

const options = [
  { value: "solo", title: "Solo", description: "Uma aventura focada em você mesmo.", icon: <IconUser size={32} /> },
  { value: "casal", title: "Casal", description: "Momentos especiais a dois.", icon: <IconHeart size={32} /> },
  { value: "familia", title: "Família", description: "Divertimento para todas as idades.", icon: <IconUsers size={32} /> },
  { value: "amigos", title: "Amigos", description: "Histórias inesquecíveis em grupo.", icon: <IconUsers size={32} /> },
];

export function TripPreferencesPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("casal");

  return (
    <MobilePage className="tight">
      <ScreenHeader title="Quem vai com você?" subtitle="Selecione quem irá compartilhar essa jornada única com você." backTo="/traveler-dna" skipTo="/" />
      <div className="option-list">
        {options.map((option) => (
          <OptionCard key={option.value} {...option} selected={selected === option.value} onClick={() => setSelected(option.value)} />
        ))}
      </div>
      <PrimaryButton type="button" onClick={() => navigate("/generate")}>
        Próximo passo
      </PrimaryButton>
      <HomeIndicator />
    </MobilePage>
  );
}
