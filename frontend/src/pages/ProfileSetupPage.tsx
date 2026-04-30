import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { HomeIndicator, IconFootprints, IconGauge, IconLeaf, MobilePage, OptionCard, PrimaryButton, ScreenHeader } from "../components/ui/ViajeroUI";

const options = [
  { value: "relaxante", title: "Relaxante", description: "Spas, manhãs tranquilas e alta gastronomia.", icon: <IconLeaf size={32} /> },
  { value: "moderado", title: "Moderado", description: "Uma mistura de turismo e lazer.", icon: <IconFootprints size={32} /> },
  { value: "acelerado", title: "Acelerado", description: "Começos cedo e roteiros cheios.", icon: <IconGauge size={32} /> },
];

export function ProfileSetupPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("acelerado");

  return (
    <MobilePage className="tight">
      <ScreenHeader title="Ritmo da viagem" subtitle="Como você gosta de aproveitar o dia?" backTo="/register" skipTo="/" />
      <div className="option-list">
        {options.map((option) => (
          <OptionCard key={option.value} {...option} selected={selected === option.value} onClick={() => setSelected(option.value)} />
        ))}
      </div>
      <PrimaryButton type="button" onClick={() => navigate("/traveler-dna")}>
        Próximo passo
      </PrimaryButton>
      <HomeIndicator />
    </MobilePage>
  );
}
