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
    <aside className="onboarding-story flex min-w-0 flex-col gap-6 overflow-hidden">
      <div className="hidden flex-col gap-3 lg:flex">
        <h1 className="font-semibold leading-tight">{title}
        </h1>
        <p className="text-sm leading-6 text-white">{description}
        </p>
      </div>

      <nav
        className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-5"
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
                    ? "border-primary bg-primary text-white"
                    : "border-input bg-surface text-muted-foreground",
                )}
              >
                {isDone ? <Check size={12} strokeWidth={3} /> : <span className="text-xs">{i + 1}</span>}
              </div>

              <span
                className={cn(
                  "hidden text-sm leading-none lg:inline",
                  isActive ? "font-semibold text-white" : "text-white/75",
                )}
              >
                {step.label}
              </span>

            </div>
          );
        })}
      </nav>
    </aside>
  );
}
