import {
  CalendarDays,
  Bus,
  Car,
  Crown,
  Hotel,
  Salad,
  Accessibility,
  Sparkles,
  Wallet,
  Plane,
} from "lucide-react";
import type {
  DropdownOption,
  OnboardingStep,
} from "@/pages/onboarding/onboarding.data";

const CURRENCY_OPTIONS: DropdownOption[] = [
  { label: "Real (BRL)", value: "BRL" },
  { label: "Dolar (USD)", value: "USD" },
  { label: "Euro (EUR)", value: "EUR" },
];

const MONTH_OPTIONS: DropdownOption[] = [
  { label: "Janeiro", value: "January" },
  { label: "Fevereiro", value: "February" },
  { label: "Marco", value: "March" },
  { label: "Abril", value: "April" },
  { label: "Maio", value: "May" },
  { label: "Junho", value: "June" },
  { label: "Julho", value: "July" },
  { label: "Agosto", value: "August" },
  { label: "Setembro", value: "September" },
  { label: "Outubro", value: "October" },
  { label: "Novembro", value: "November" },
  { label: "Dezembro", value: "December" },
];

const TRIP_LENGTH_OPTIONS: DropdownOption[] = [
  { label: "Final de semana (2-3 dias)", value: "3" },
  { label: "Semana curta (4-6 dias)", value: "5" },
  { label: "1 semana", value: "7" },
  { label: "2 semanas", value: "14" },
  { label: "3 semanas", value: "21" },
  { label: "1 mês ou mais", value: "30" },
];

export const TRAVEL_PREFERENCES_STEPS: OnboardingStep[] = [
  {
    key: "budget",
    label: "Orçamento",
    title: "Faixa de investimento",
    sub: "Defina o intervalo de gasto ideal para que as recomendacoes respeitem sua realidade.",
    fields: [
      {
        type: "currency",
        key: "budget_min",
        label: "Orçamento minimo",
        required: true,
        hint: "Valor apróximado para iniciar a busca.",
      },
      {
        type: "currency",
        key: "budget_max",
        label: "Orçamento maximo",
        required: true,
        hint: "Limite confortavel para a viagem.",
      },
      {
        type: "dropdown",
        key: "currency_code",
        label: "Moeda",
        required: true,
        options: CURRENCY_OPTIONS,
      },
    ],
  },
  {
    key: "timing",
    label: "Período",
    title: "Duração e epoca",
    sub: "Ajuste tempo de viagem, mes de preferencia e flexibilidade de datas.",
    fields: [
      {
        type: "dropdown",
        key: "preferred_trip_length_days",
        label: "Duração ideal",
        required: true,
        icon: "calendar",
        options: TRIP_LENGTH_OPTIONS,
      },
      {
        type: "dropdown",
        key: "travel_month",
        label: "Mes preferido",
        required: true,
        icon: "calendar",
        options: MONTH_OPTIONS,
      },
      {
        type: "cards",
        cards: [
          {
            icon: CalendarDays,
            title: "Datas flexíveis",
            desc: "Posso adaptar o período se isso melhorar preço ou experiência.",
            value: "true",
          },
          {
            icon: Wallet,
            title: "Datas fixas",
            desc: "Preciso manter um período específico para viajar.",
            value: "false",
          },
        ],
      },
    ],
  },
  {
    key: "stay",
    label: "Hospedagem",
    title: "Nível de hospedagem",
    sub: "Escolha o equilíbrio entre custo, conforto e exclusividade.",
    fields: [
      {
        type: "cards",
        cards: [
          {
            icon: Plane,
            title: "Essencial",
            desc: "Funcional, prático e com foco em custo-beneficio.",
            value: "budget",
          },
          {
            icon: Hotel,
            title: "Confortavel",
            desc: "Boa estrutura e conforto na medida certa.",
            value: "mid",
          },
          {
            icon: Crown,
            title: "Elevado",
            desc: "Mais comodidade, serviço e experiência premium.",
            value: "luxury",
          },
        ],
      },
    ],
  },
  {
    key: "transport",
    label: "Deslocamento",
    title: "Estilo de deslocamento",
    sub: "Como você prefere circular pelo destino durante a viagem?",
    fields: [
      {
        type: "cards",
        cards: [
          {
            icon: Bus,
            title: "Transporte publico",
            desc: "Metro, ônibus e modais locais com boa autonomia.",
            value: "public",
          },
          {
            icon: Car,
            title: "Misto",
            desc: "Combino apps, transfers e transporte público conforme a necessidade.",
            value: "mixed",
          },
          {
            icon: Crown,
            title: "Privado",
            desc: "Prefiro carro, transfer ou deslocamentos mais exclusivos.",
            value: "private",
          },
        ],
      },
    ],
  },
  {
    key: "needs",
    label: "Cuidados",
    title: "Restricoes e acessibilidade",
    sub: "Selecione os pontos que precisam ser considerados para sua experiência ficar realmente adequada.",
    fields: [
      {
        type: "tags",
        key: "dietary_preferences",
        label: "preferências alimentares",
        multi: true,
        options: [
          { label: "Vegetariana", value: "vegetarian" },
          { label: "Vegana", value: "vegan" },
          { label: "Sem glúten", value: "gluten_free" },
          { label: "Sem lactose", value: "lactose_free" },
        ],
      },
      {
        type: "tags",
        key: "accessibility_needs",
        label: "Necessidades de acessibilidade",
        multi: true,
        options: [
          { label: "Mobilidade reduzida", value: "mobility" },
          { label: "Apoio auditivo", value: "hearing" },
          { label: "Apoio visual", value: "visual" },
        ],
      },
    ],
  },
  {
    key: "interests",
    label: "Interesses",
    title: "Interesses da viagem",
    sub: "Esses temas ajudam a IA a priorizar experiências mais aderentes ao seu perfil.",
    fields: [
      {
        type: "tags",
        key: "interests",
        label: "O que você quer priorizar?",
        required: true,
        multi: true,
        options: [
          { label: "Gastronomia", value: "food" },
          { label: "Cultura", value: "culture" },
          { label: "Natureza", value: "nature" },
          { label: "Vida noturna", value: "nightlife" },
          { label: "Relaxamento", value: "wellness" },
          { label: "Compras", value: "shopping" },
        ],
      },
    ],
  },
];

export const TRAVEL_PREFERENCES_SIDEBAR = {
  title: "Configure suas preferências de viagem",
  description:
    "Esses dados refinam os roteiros com faixa de gasto, período e necessidades reais da sua viagem.",
};
