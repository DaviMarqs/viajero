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
  | { type: "cards"; cards: CardOption[]; multi?: boolean }
  | { type: "currency"; key: string; label: string; hint?: string; required?: boolean }
  | { type: "dropdown"; key: string; label: string; options: DropdownOption[]; icon?: "calendar" | "none"; hint?: string; required?: boolean }
  | { type: "tags"; key: string; label: string; options: TagOption[]; multi?: boolean; hint?: string; required?: boolean }
  | { type: "textarea"; key: string; label: string; placeholder?: string; hint?: string; required?: boolean }
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
    key: "ritmo",
    label: "Ritmo da viagem",
    title: "Ritmo de viagem",
    sub: "Como você prefere viver suas viagens?",
    fields: [
      {
        type: "cards",
        cards: [
          { icon: Building2, title: "Aventura Imersiva", desc: "Explore cada canto, interaja com a cultura local e viva experiências únicas.", value: "adventure" },
          { icon: Footprints, title: "Equilíbrio Perfeito", desc: "Combine atividades emocionantes com momentos de descanso e bem-estar.", value: "balanced" },
          { icon: Leaf, title: "Relaxamento Total", desc: "Desconecte-se do mundo, aproveite paisagens serenas e revitalize o corpo e a mente.", value: "relaxed" },
        ],
      },
    ],
  },
  {
    key: "experiencia",
    label: "Experiência",
    title: "Tipo de experiência",
    sub: "Que tipo de experiências você mais valoriza em uma viagem?",
    fields: [
      {
        type: "cards",
        multi: true,
        cards: [
          { icon: UtensilsCrossed, title: "Gastronomia & Cultura", desc: "Provar pratos típicos, visitar museus e mergulhar na história local.", value: "food_culture" },
          { icon: Mountain, title: "Natureza & Aventura", desc: "Trilhas, cachoeiras, mergulho e contato direto com o meio ambiente.", value: "nature_adventure" },
          { icon: Music, title: "Entretenimento & Festas", desc: "Shows, baladas, eventos e a vida noturna dos destinos.", value: "nightlife" },
        ],
      },
    ],
  },
  {
    key: "conforto",
    label: "Nível de conforto",
    title: "Nível de conforto",
    sub: "Qual o nível de conforto que você espera na sua viagem?",
    fields: [
      {
        type: "cards",
        cards: [
          { icon: Backpack, title: "Econômico", desc: "Hostels, transporte público e o essencial para aproveitar ao máximo.", value: "budget" },
          { icon: Home, title: "Confortável", desc: "Hotéis de boa qualidade, sem exageros, mas sem abrir mão do conforto.", value: "standard" },
          { icon: Crown, title: "Premium", desc: "Resorts, voos executivos e experiências de alto padrão.", value: "premium" },
        ],
      },
    ],
  },
  {
    key: "companhia",
    label: "Quem vai com você?",
    title: "Companhia de viagem",
    sub: "Você costuma viajar com quem?",
    fields: [
      {
        type: "cards",
        cards: [
          { icon: User, title: "Solo", desc: "Liberdade total para seguir seu próprio ritmo e descobrir o mundo.", value: "solo" },
          { icon: Heart, title: "Casal", desc: "Roteiros românticos e momentos a dois inesquecíveis.", value: "couple" },
          { icon: Users, title: "Amigos", desc: "Diversão garantida em grupo, dividindo cada aventura.", value: "friends" },
          { icon: Baby, title: "Família", desc: "Conforto e atividades para todas as idades curtirem juntos.", value: "family" },
        ],
      },
    ],
  },
  {
    key: "adicionais",
    label: "Preferências adicionais",
    title: "Preferências adicionais",
    sub: "Selecione tudo que você gostaria de priorizar nas suas viagens.",
    fields: [
      {
        type: "cards",
        multi: true,
        cards: [
          { icon: Sprout, title: "Sustentabilidade", desc: "Prefiro destinos e experiências com impacto ambiental reduzido.", value: "sustainability" },
          { icon: Accessibility, title: "Acessibilidade", desc: "Preciso de locais com boa estrutura para mobilidade reduzida.", value: "accessibility" },
          { icon: Languages, title: "Idioma local", desc: "Prefiro destinos onde consigo me comunicar sem barreira de idioma.", value: "local_language" },
        ],
      },
    ],
  },
  {
    key: "orcamento",
    label: "Orçamento & Duração",
    title: "Orçamento & Duração",
    sub: "Nos conta quanto você pretende gastar e por quanto tempo vai viajar.",
    fields: [
      {
        type: "currency",
        key: "budget",
        label: "Orçamento",
        required: true,
        hint: "Precisamos saber seu orçamento para filtrar as melhores opções de hospedagem para você.",
      },
      {
        type: "dropdown",
        key: "trip_length",
        label: "Duração da viagem",
        required: true,
        icon: "calendar",
        options: [
          { label: "Final de semana (2-3 dias)", value: "3" },
          { label: "Semana curta (4-6 dias)", value: "5" },
          { label: "1 semana (7 dias)", value: "7" },
          { label: "2 semanas (14-15 dias)", value: "14" },
          { label: "3 semanas (21 dias)", value: "21" },
          { label: "1 mês ou mais", value: "30" },
        ],
      },
    ],
  },
  {
    key: "destino",
    label: "Destino & Clima",
    title: "Destino & Clima",
    sub: "Que tipo de destino e clima combinam com você?",
    fields: [
      {
        type: "tags",
        key: "destination_types",
        label: "Tipo de destino",
        required: true,
        multi: true,
        options: [
          { label: "Praia", value: "beach" },
          { label: "Cidade", value: "city" },
          { label: "Natureza", value: "nature" },
          { label: "Nacional", value: "domestic" },
          { label: "Internacional", value: "international" },
        ],
      },
      {
        type: "tags",
        key: "climate",
        label: "Clima de preferência",
        required: true,
        multi: true,
        options: [
          { label: "Calor", value: "hot" },
          { label: "Frio", value: "cold" },
          { label: "Ameno", value: "mild" },
          { label: "Tropical", value: "tropical" },
          { label: "Neutro", value: "any" },
          { label: "Não tenho preferência", value: "no_preference" },
        ],
      },
    ],
  },
  {
    key: "interesses",
    label: "Interesses & Restrições",
    title: "Interesses & Restrições",
    sub: "O que você quer viver nessa viagem? E há algo que precisamos considerar?",
    fields: [
      {
        type: "tags",
        key: "interests",
        label: "Interesses",
        required: true,
        multi: true,
        options: [
          { label: "Gastronomia", value: "gastronomy" },
          { label: "Natureza", value: "nature" },
          { label: "Cultural", value: "cultural" },
          { label: "Aventura", value: "adventure" },
          { label: "Trilhas", value: "hiking" },
          { label: "Lazer", value: "leisure" },
          { label: "Paisagens", value: "landscapes" },
          { label: "Pontos turísticos", value: "landmarks" },
          { label: "Fotografias", value: "photography" },
          { label: "Festas", value: "parties" },
          { label: "Compras", value: "shopping" },
        ],
      },
      {
        type: "dropdown",
        key: "restrictions",
        label: "Restrições (opcional)",
        hint: "Restrições alimentares, acessibilidade",
        options: [
          { label: "Nenhuma", value: "none" },
          { label: "Sou vegetariano(a)", value: "vegetarian" },
          { label: "Sou vegano(a)", value: "vegan" },
          { label: "Tenho restrição de mobilidade", value: "mobility" },
          { label: "Alergia alimentar", value: "food_allergy" },
          { label: "Outra", value: "other" },
        ],
      },
      {
        type: "textarea",
        key: "notes",
        label: "Observações adicionais (opcional)",
        placeholder: "Ex: Gosto muito de surfar, prefiro hotéis com piscina...",
        hint: "Informações que você não encontrou acima",
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