import { useEffect, useState } from "react";
export type GenerationStage = "preparing" | "generating" | "ready";
export function GenerationProgress({ stage }: { stage: GenerationStage }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const started = Date.now(); const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000); return () => window.clearInterval(timer); }, []);
  const index = ["preparing", "generating", "ready"].indexOf(stage);
  return <section className="space-y-4" aria-label="Progresso do roteiro" aria-busy={stage !== "ready"}>
    <h2 className="section-title">Montando seu roteiro</h2>
    <ol className="space-y-2">{["Preparando sua viagem", "Montando dias e atividades com IA", "Roteiro pronto"].map((label, i) => <li key={label} aria-current={i === index ? "step" : undefined} className={i > index ? "text-muted-foreground" : "font-medium"}>{i < index ? "Concluído: " : i === index ? "Agora: " : "A seguir: "}{label}</li>)}</ol>
    <p role="status" className="text-sm text-muted-foreground">{stage === "generating" ? "Estamos organizando as atividades com suas preferências. Essa etapa pode levar alguns minutos." : stage === "ready" ? "Tudo pronto para conferir sua viagem." : "Estamos preparando as informações da sua viagem."}</p>
    {stage !== "ready" && <><progress aria-label="Aguardando a geração do roteiro" className="w-full" /><p className="text-xs text-muted-foreground">Tempo decorrido: {Math.floor(seconds / 60)}min {seconds % 60}s</p></>}
  </section>;
}
