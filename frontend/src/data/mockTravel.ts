export type MockDestinationCard = {
  id: number;
  title: string;
  country: string;
  subtitle: string;
  price: string;
  duration: string;
  image: string;
  recommendation?: string;
  saved?: boolean;
};

export type MockItineraryStop = {
  title: string;
  time: string;
  description: string;
  image: string;
  tip?: string;
};

export const recommendationCards: MockDestinationCard[] = [
  {
    id: 1,
    title: "Fernando de Noronha, Brasil",
    country: "Brasil",
    subtitle: "Praias incríveis e contato com a natureza",
    price: "A partir de R$5.000,00",
    duration: "7 dias",
    recommendation: "Combina com o seu perfil: Natureza, fotografias, viagem em casal",
    image: "https://www.figma.com/api/mcp/asset/1e94334b-5267-4a0d-aace-26edccc2b379",
  },
  {
    id: 2,
    title: "Ao Nang, Tailândia",
    country: "Tailândia",
    subtitle: "Um dos destinos mais impressionantes do sul da Tailândia",
    price: "A partir de R$5.000,00",
    duration: "7 dias",
    recommendation: "Combina com o seu perfil: Natureza, fotografias, viagem em casal",
    image: "https://www.figma.com/api/mcp/asset/b6600034-10f3-42d9-9538-6d553789710b",
  },
  {
    id: 3,
    title: "Maldivas, Maldivas",
    country: "Maldivas",
    subtitle: "Resorts de luxo + mar surreal + privacidade total",
    price: "A partir de R$5.000,00",
    duration: "7 dias",
    recommendation: "Combina com o seu perfil: Natureza, fotografias, viagem em casal",
    image: "https://www.figma.com/api/mcp/asset/c86aa7a5-1b7b-4726-8108-4a035baa326d",
  },
  {
    id: 4,
    title: "Havaí, Estados Unidos",
    country: "Estados Unidos",
    subtitle: "Clássico do surfe mundial com paisagens vulcânicas",
    price: "A partir de R$5.000,00",
    duration: "7 dias",
    recommendation: "Combina com o seu perfil: Natureza, fotografias, viagem em casal",
    image: "https://www.figma.com/api/mcp/asset/0daa45b1-ddf9-457a-8fb5-a2acd41bd917",
  },
  {
    id: 5,
    title: "Bali, Indonésia",
    country: "Indonésia",
    subtitle: "Cultura, surfe e paisagens tropicais cinematográficas",
    price: "A partir de R$5.000,00",
    duration: "7 dias",
    recommendation: "Combina com o seu perfil: Natureza, fotografias, viagem em casal",
    image: "https://www.figma.com/api/mcp/asset/fea348e9-f272-4987-972d-044911ba5bff",
  },
];

export const savedCards: MockDestinationCard[] = [
  {
    ...recommendationCards[0],
    title: "Florianópolis, Brasil",
    subtitle: "Praias incríveis e contato com a natureza",
    image: "https://www.figma.com/api/mcp/asset/c4855793-9e83-4ee2-a50e-737a7bf55e61",
    saved: true,
  },
];

export const beachHighlight: MockDestinationCard = {
  id: 99,
  title: "Florianópolis, Brasil",
  country: "Brasil",
  subtitle: "Praias incríveis e contato com a natureza",
  price: "A partir de R$5.000,00",
  duration: "7 dias",
  image: "https://www.figma.com/api/mcp/asset/e1b49477-3964-4642-a131-132d1aac2f1f",
};

export const itineraryStops: MockItineraryStop[] = [
  {
    title: "Café da manhã no Centro",
    time: "08:30",
    description: "Comece o dia com uma cafeteria autoral e planejamento leve da rota.",
    image: "https://www.figma.com/api/mcp/asset/53b1fa43-ce63-4a39-841e-63ac9eb8d4c0",
    tip: "Dica: reserve uma mesa externa para aproveitar a vista logo cedo.",
  },
  {
    title: "Passeio de barco",
    time: "11:00",
    description: "Saída para praias e ilhas com águas mais calmas e visual cinematográfico.",
    image: "https://www.figma.com/api/mcp/asset/53b1fa43-ce63-4a39-841e-63ac9eb8d4c0",
  },
  {
    title: "Almoço à beira-mar",
    time: "13:30",
    description: "Menu com frutos do mar frescos e parada estratégica para descanso.",
    image: "https://www.figma.com/api/mcp/asset/53b1fa43-ce63-4a39-841e-63ac9eb8d4c0",
  },
  {
    title: "Fim de tarde no mirante",
    time: "17:45",
    description: "Encerramento com pôr do sol, fotos e um drink leve antes do jantar.",
    image: "https://www.figma.com/api/mcp/asset/53b1fa43-ce63-4a39-841e-63ac9eb8d4c0",
  },
];

export const destinationDetail = {
  hero: "https://www.figma.com/api/mcp/asset/13055c93-d209-441e-80ba-1506ed3d514f",
  title: "Ao Nang",
  subtitle: "Krabi, Tailândia",
  badges: ["Praia", "Tropical", "$$$", "Internacional", "Paradisíaco", "Oriente", "97% de match"],
  about:
    "Localizada na província de Krabi, Ao Nang é um dos destinos mais impressionantes do sul da Tailândia. Cercada por falésias calcárias gigantes, mar em tons de azul-esmeralda e dezenas de ilhas ao redor, a região combina perfeitamente aventura, relaxamento e paisagens cinematográficas.",
  bestTime: [
    { title: "Nov – Abr", subtitle: "Tempo seco, mar calmo, céu limpo" },
    { title: "Mai – Out", subtitle: "Chuvas, menos turistas, preços baixos" },
  ],
  expectations: [
    "Praias com água quente e cristalina",
    "Passeios de barco entre ilhas e lagoas escondidas",
    "Cenário tropical com trilhas, falésias e mirantes",
  ],
  prep: [
    "Leve roupas leves e respiráveis",
    "Protetor solar é essencial",
    "Use repelente especialmente à noite",
    "Reserve passeios com antecedência na alta temporada",
  ],
  tips: [
    "Faça island hopping entre ilhas",
    "Chegue cedo nas praias para evitar multidões",
    "Negocie preços de passeios locais",
    "Alugue caiaque para explorar áreas escondidas",
  ],
  attractions: [
    {
      tag: "Natureza",
      title: "Railay Beach",
      description: "Destino icônico com águas cristalinas e paisagens de filme.",
      image: "https://www.figma.com/api/mcp/asset/6f7a667e-1a39-48de-89db-ab4dbadd267f",
    },
    {
      tag: "Natureza",
      title: "Ilhas Hong",
      description: "Perfeitas para quem busca águas calmas e menos movimento.",
      image: "https://www.figma.com/api/mcp/asset/134b49f0-a96c-4843-85a5-bec1c1c699e8",
    },
  ],
  cuisine: [
    {
      title: "Pad Thai",
      description: "Macarrão frito com frutos do mar ou frango.",
      image: "https://www.figma.com/api/mcp/asset/ca112ae1-62ee-416d-be1c-9672c14091c9",
    },
    {
      title: "Tom Yum",
      description: "Sopa picante e aromática.",
      image: "https://www.figma.com/api/mcp/asset/e00c5c4c-9390-4199-b7f7-8ce616892f99",
    },
    {
      title: "Green Curry",
      description: "Curry cremoso com especiarias.",
      image: "https://www.figma.com/api/mcp/asset/55267f8d-ac5f-4ad5-a2f7-04e4ff4e9abb",
    },
  ],
  testimonials: [
    {
      name: "Mariana S.",
      text: "Lugar simplesmente surreal. As falésias em Railay são coisa de outro mundo.",
    },
    {
      name: "Lucas M.",
      text: "Ao Nang é perfeita pra quem quer explorar sem abrir mão de conforto.",
    },
    {
      name: "Jessica T.",
      text: "Um dos lugares mais bonitos que já visitei. Os passeios de barco valem cada centavo.",
    },
  ],
};
