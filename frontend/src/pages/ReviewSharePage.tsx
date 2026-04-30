import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { viajeroApi } from "../api/viajero";
import { HomeIndicator, IconFootprints, IconMap, IconPlane, MobilePage, OptionCard, PrimaryButton, ScreenHeader } from "../components/ui/ViajeroUI";
import { useSession } from "../hooks/useSession";

const options = [
  { value: "iniciante", title: "Iniciante", description: "Ainda não viajei por muitos lugares.", icon: <IconFootprints size={32} /> },
  { value: "intermediario", title: "Intermediário", description: "Já carimbei o passaporte algumas vezes e sei me virar.", icon: <IconMap size={32} /> },
  { value: "experiente", title: "Experiente", description: "Sou um cidadão do mundo e busco desafios autênticos.", icon: <IconPlane size={32} /> },
];

export function ReviewSharePage() {
  const { id = "1" } = useParams();
  const { session } = useSession();
  const navigate = useNavigate();
  const [selected, setSelected] = useState("intermediario");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await viajeroApi.createReview(
      { itinerary: Number(id), rating: selected === "experiente" ? 5 : 4, body: `Perfil escolhido: ${selected}` },
      session.access,
    );
    navigate(`/itineraries/${id}`);
  }

  return (
    <MobilePage className="tight">
      <ScreenHeader
        title="Sua experiência"
        subtitle="Quanto você já explorou o mundo? Personalize sua curadoria com base na sua bagagem."
        backTo="/trip-preferences"
        skipTo="/"
      />
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
