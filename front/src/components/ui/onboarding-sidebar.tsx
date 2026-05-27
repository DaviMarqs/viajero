import { Check } from "lucide-react";
import type { OnboardingStep } from "../../pages/onboarding/onboarding.data";
import { ONBOARDING_STEPS } from "../../pages/onboarding/onboarding.data";
import { cn } from "../../lib/utils";

interface OnboardingSidebarProps {
  currentIndex: number;
  steps?: OnboardingStep[];
  title?: string;
  description?: string;
}

export default function OnboardingSidebar({
  currentIndex,
  steps = ONBOARDING_STEPS,
  title = "Configure o seu DNA de Viajante",
  description = "Suas preferências permitem que a IA recomende destinos e monte roteiros feitos para você.",
}: OnboardingSidebarProps) {
  return (
    <aside className="flex w-full flex-col gap-6 overflow-hidden bg-[linear-gradient(160deg,#2e8cff_0%,#1553c6_45%,#0c2f73_100%)] p-6 text-white lg:m-4 lg:w-[22rem] lg:rounded-[28px] lg:p-8">
      <div className="hidden flex-col gap-3 lg:flex">
        <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
        <p className="text-sm leading-6 text-white/68">{description}</p>
      </div>

      <nav
        className="flex flex-1 gap-2 overflow-x-auto lg:flex-col lg:gap-4"
        aria-label="Progresso do cadastro"
      >
        {steps.map((step: OnboardingStep, i: number) => {
          const isDone = i < currentIndex;
          const isActive = i === currentIndex;

          return (
            <div
              key={step.key}
              className="flex items-center gap-3 rounded-full lg:rounded-none"
              aria-current={isActive ? "step" : undefined}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition",
                  isDone || isActive
                    ? "border-white bg-white text-sky-700"
                    : "border-white/15 bg-white/10 text-transparent",
                )}
              >
                {isDone && <Check size={10} strokeWidth={3} />}
              </div>

              <span
                className={cn(
                  "hidden text-sm leading-none lg:inline",
                  isActive ? "font-semibold text-white" : "text-white/50",
                )}
              >
                {step.label}
              </span>

              {isActive && (
                <div className="hidden h-px w-8 rounded-full bg-white lg:block" />
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
