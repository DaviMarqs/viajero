import { FormEvent, useState } from "react";

import { viajeroApi } from "../api/viajero";
import { FormField, IconInfo, MobilePage, PrimaryButton, ScreenHeader, TextAreaField } from "../components/ui/ViajeroUI";
import { useSession } from "../hooks/useSession";

export function FirecrawlAdminPage() {
  const { session } = useSession();
  const [destinationId, setDestinationId] = useState("1");
  const [sourceUrls, setSourceUrls] = useState("https://example.com/travel-guide");
  const [notes, setNotes] = useState("Use esta área para enriquecer destinos manualmente.");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await viajeroApi.triggerFirecrawl(
      { destination_id: Number(destinationId), source_urls: sourceUrls.split(",").map((value) => value.trim()) },
      session.access,
    );
  }

  return (
    <MobilePage>
      <ScreenHeader title="Painel Firecrawl" subtitle="Tela utilitária mantida consistente com a nova linguagem visual." backTo="/" />
      <form className="form-grid" onSubmit={onSubmit}>
        <FormField label="Destination ID" required icon={<IconInfo size={20} />}>
          <input value={destinationId} onChange={(event) => setDestinationId(event.target.value)} />
        </FormField>
        <TextAreaField label="Source URLs" value={sourceUrls} onChange={setSourceUrls} hint="Separe múltiplas URLs por vírgula." />
        <TextAreaField label="Observações" optional value={notes} onChange={setNotes} />
        <PrimaryButton type="submit">Trigger enrichment</PrimaryButton>
      </form>
    </MobilePage>
  );
}
