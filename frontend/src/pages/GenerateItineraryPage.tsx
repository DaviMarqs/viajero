import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { viajeroApi } from "../api/viajero";
import { ChipGroup, FormField, HomeIndicator, IconCalendar, IconInfo, MobilePage, PrimaryButton, ScreenHeader, TextAreaField } from "../components/ui/ViajeroUI";
import { useSession } from "../hooks/useSession";

const destinationTypes = ["Praia", "Cidade", "Natureza", "Nacional", "Internacional"];
const weatherTypes = ["Calor", "Frio", "Neve", "Temperado"];
const interests = ["Gastronomia", "Natureza", "Cultural", "Aventura", "Trilhas", "Lazer", "Paisagens", "Fotografias"];

export function GenerateItineraryPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [budget, setBudget] = useState("R$5.000,00");
  const [duration, setDuration] = useState("15 dias");
  const [destination, setDestination] = useState(["Praia", "Nacional"]);
  const [weather, setWeather] = useState(["Calor"]);
  const [selectedInterests, setSelectedInterests] = useState(["Gastronomia", "Natureza", "Aventura"]);
  const [restrictions, setRestrictions] = useState("Sou vegetariano(a)");
  const [notes, setNotes] = useState("Gosto muito de surfar");

  function toggleValue(value: string, state: string[], setState: (items: string[]) => void) {
    setState(state.includes(value) ? state.filter((item) => item !== value) : [...state, value]);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await viajeroApi.createTripPreferences(
      {
        budget_min: 5000,
        budget_max: 5000,
        currency_code: "BRL",
        preferred_trip_length_days: Number(duration.replace(/\D/g, "")) || 15,
        travel_month: weather.join(", "),
        hotel_level: destination.join(", "),
        transportation_style: selectedInterests.join(", "),
      },
      session.access,
    );
    navigate("/itineraries/1/timeline");
  }

  return (
    <MobilePage>
      <ScreenHeader
        title="Preferências adicionais"
        subtitle="Personalize sua experiência para encontrarmos o destino ideal."
        backTo="/trip-preferences"
        skipTo="/"
      />
      <form className="form-grid" onSubmit={onSubmit}>
        <FormField
          label="Orçamento"
          required
          icon={<IconInfo size={20} />}
          hint="Precisamos saber seu orçamento para filtrar as melhores opções de hospedagem para você."
        >
          <input value={budget} onChange={(event) => setBudget(event.target.value)} />
        </FormField>
        <FormField label="Duração da viagem" required icon={<IconCalendar size={20} />}>
          <input value={duration} onChange={(event) => setDuration(event.target.value)} />
        </FormField>
        <div className="field">
          <span className="field-label">
            Tipo de destino
            <small>*</small>
          </span>
          <ChipGroup items={destinationTypes} selected={destination} onToggle={(value) => toggleValue(value, destination, setDestination)} />
        </div>
        <div className="field">
          <span className="field-label">
            Clima de preferência
            <small>*</small>
          </span>
          <ChipGroup items={weatherTypes} selected={weather} onToggle={(value) => toggleValue(value, weather, setWeather)} />
        </div>
        <div className="field">
          <span className="field-label">
            Interesses
            <small>*</small>
          </span>
          <ChipGroup items={interests} selected={selectedInterests} onToggle={(value) => toggleValue(value, selectedInterests, setSelectedInterests)} />
        </div>
        <FormField label="Restrições" optional icon={<IconInfo size={20} />} hint="Restrições alimentares, acessibilidade">
          <input value={restrictions} onChange={(event) => setRestrictions(event.target.value)} />
        </FormField>
        <TextAreaField label="Observações adicionais" optional value={notes} onChange={setNotes} hint="Informações que você não encontrou acima" />
        <PrimaryButton type="submit">Próximo passo</PrimaryButton>
      </form>
      <HomeIndicator />
    </MobilePage>
  );
}
