import {
  Building2,
  Footprints,
  Leaf,
  UtensilsCrossed,
  Mountain,
  Music,
  Backpack,
  Home,
  Crown,
  User,
  Heart,
  Users,
  Baby,
  Sprout,
  Accessibility,
  Languages,
  type LucideIcon,
} from "lucide-react";

// ── Tipos base ────────────────────────────────────────────────

export interface CardOption {
  icon: LucideIcon;
  title: string;
  desc: string;
  value: string | number;
}

export interface TagOption {
  label: string;
  value: string;
}

export interface DropdownOption {
  label: string;
  value: string;
}

// Discriminated union — cada field sabe exatamente o que renderizar
export type StepField =
  | { type: "cards"; key?: string; cards: CardOption[]; multi?: boolean }
  | {
      type: "currency";
      key: string;
      label: string;
      hint?: string;
      required?: boolean;
    }
  | {
      type: "dropdown";
      key: string;
      label: string;
      hint?: string;
      required?: boolean;
      icon?: string;
      options: DropdownOption[];
    }
  | {
      type: "tags";
      key: string;
      label: string;
      hint?: string;
      required?: boolean;
      multi?: boolean;
      options: DropdownOption[];
    }
  | {
      type: "range";
      key: string;
      label: string;
      span: string;
      min: number;
      max: number;
      step?: number;
      hint?: string;
      required?: boolean;
    }
  | {
      type: "textarea";
      key: string;
      label: string;
      placeholder?: string;
      hint?: string;
      required?: boolean;
    }
  | { type: "empty" };

export interface OnboardingStep {
  key: string;
  label: string;
  title: string;
  sub: string;
  fields: StepField[];
}

// ── Steps ─────────────────────────────────────────────────────

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: "estilo",
    label: "Estilo",
    title: "Qual seu estilo de viagem?",
    sub: "Escolha a opção que mais combina com você.",
    fields: [
      {
        type: "cards",
        key: "travel_style",
        cards: [
          {
            icon: Building2,
            title: "Aventura",
            desc: "Gosto de explorar bastante e viver experiências intensas.",
            value: "adventure",
          },
          {
            icon: Footprints,
            title: "Equilibrado",
            desc: "Gosto de misturar passeios, descanso e boas experiências.",
            value: "balanced",
          },
          {
            icon: Leaf,
            title: "Relaxado",
            desc: "Prefiro viagens mais tranquilas e sem pressa.",
            value: "relaxed",
          },
        ],
      },
    ],
  },
  {
    key: "ritmo",
    label: "Ritmo",
    title: "Qual ritmo você prefere?",
    sub: "Isso ajuda a montar roteiros no seu tempo.",
    fields: [
      {
        type: "cards",
        key: "pace",
        cards: [
          {
            icon: Leaf,
            title: "Leve",
            desc: "Poucas atividades por dia, com bastante tempo livre.",
            value: "slow",
          },
          {
            icon: Footprints,
            title: "Moderado",
            desc: "Um ritmo equilibrado, sem correria.",
            value: "moderate",
          },
          {
            icon: Backpack,
            title: "Intenso",
            desc: "Quero aproveitar o máximo possível todos os dias.",
            value: "fast",
          },
        ],
      },
    ],
  },
  {
    key: "conforto",
    label: "Conforto",
    title: "Qual nível de conforto você busca?",
    sub: "Escolha o padrão ideal para sua viagem.",
    fields: [
      {
        type: "cards",
        key: "comfort_level",
        cards: [
          {
            icon: Backpack,
            title: "Econômico",
            desc: "Prefiro economizar e focar nas experiências.",
            value: "budget",
          },
          {
            icon: Home,
            title: "Intermediário",
            desc: "Quero conforto, mas sem exageros.",
            value: "mid",
          },
          {
            icon: Crown,
            title: "Premium",
            desc: "Busco mais comodidade e experiências de alto padrão.",
            value: "premium",
          },
        ],
      },
    ],
  },
  {
    key: "preferências",
    label: "Preferências",
    title: "O que combina mais com você?",
    sub: "Dê uma nota de 0 a 10 para cada preferência.",
    fields: [
      {
        type: "range",
        key: "social_energy",
        label: "Energia social",
        span: "Seu nível de interesse em atividades sociais e interação com pessoas.",
        min: 0,
        max: 10,
        step: 1,
      },
      {
        type: "range",
        key: "adventure_level",
        label: "Nível de aventura",
        span: "Preferência por experiências aventureiras.",
        min: 0,
        max: 10,
        step: 1,
      },
      {
        type: "range",
        key: "food_focus",
        label: "Interesse em gastronomia",
        span: "Quanto a gastronomia importa na sua viagem.",
        min: 0,
        max: 10,
        step: 1,
      },
      {
        type: "range",
        key: "cultural_interest",
        label: "Interesse cultural",
        span: "Interesse por cultura, arte e história.",
        min: 0,
        max: 10,
        step: 1,
      },
      {
        type: "range",
        key: "nature_interest",
        label: "Interesse em natureza",
        span: "Interesse por natureza e atividades ao ar livre.",
        min: 0,
        max: 10,
        step: 1,
      },
      {
        type: "range",
        key: "nightlife_interest",
        label: "Interesse em vida noturna",
        span: "Interesse em bares, festas e vida noturna.",
        min: 0,
        max: 10,
        step: 1,
      },
    ],
  },
  {
    key: "observacoes",
    label: "Observações",
    title: "Tem algo a mais que devemos saber?",
    sub: "Conte qualquer preferência extra para personalizar melhor sua experiência.",
    fields: [
      {
        type: "textarea",
        key: "notes",
        label: "Observações adicionais",
        placeholder:
          "Ex: Prefiro walking tours, gosto de museus, evito baladas...",
      },
    ],
  },
];

export const TRIP_LENGTH_OPTIONS: DropdownOption[] = [
  { label: "Final de semana (2-3 dias)", value: "3" },
  { label: "Semana curta (4-6 dias)", value: "5" },
  { label: "1 semana (7 dias)", value: "7" },
  { label: "2 semanas (14-15 dias)", value: "14" },
  { label: "3 semanas (21 dias)", value: "21" },
  { label: "1 mês ou mais", value: "30" },
];
