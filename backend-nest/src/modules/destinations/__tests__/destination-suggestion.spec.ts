import { pickSuggestedDestination } from '../destination-suggestion';

const tag = (slug: string) => ({ slug });
const lisbon = {
  id: 1,
  name: 'Lisbon',
  average_rating: '4.70',
  pois: [
    { poi_type: 'attraction', tags: [tag('cultura'), tag('historia')] },
    { poi_type: 'restaurant', tags: [tag('gastronomia')] },
    { poi_type: 'activity', tags: [tag('cultura')] },
  ],
};
const rio = {
  id: 3,
  name: 'Rio de Janeiro',
  average_rating: '4.60',
  pois: [
    { poi_type: 'attraction', tags: [tag('natureza')] },
    { poi_type: 'activity', tags: [tag('natureza')] },
    { poi_type: 'lodging', tags: [tag('praia')] },
  ],
};
const tokyo = { id: 2, name: 'Tokyo', average_rating: '4.80', pois: [] };

const culturalDna = { cultural_interest: 10, food_focus: 6, nature_interest: 2, nightlife_interest: 2, adventure_level: 3 };
const natureDna = { cultural_interest: 2, food_focus: 3, nature_interest: 10, nightlife_interest: 2, adventure_level: 8 };

describe('pickSuggestedDestination', () => {
  it('escolhe destino cultural para perfil cultural', () => {
    expect(pickSuggestedDestination([rio, lisbon, tokyo], culturalDna, { interests: ['culture'] }, [])?.destination.name).toBe('Lisbon');
  });

  it('escolhe natureza para perfil aventureiro', () => {
    expect(pickSuggestedDestination([lisbon, rio, tokyo], natureDna, { interests: ['nature'] }, [])?.destination.name).toBe('Rio de Janeiro');
  });

  it('evita destinos ja usados pelo usuario', () => {
    expect(pickSuggestedDestination([lisbon, rio, tokyo], culturalDna, null, [1])?.destination.name).toBe('Rio de Janeiro');
  });

  it('volta a considerar todos quando todos ja foram usados', () => {
    expect(pickSuggestedDestination([lisbon], culturalDna, null, [1])?.destination.name).toBe('Lisbon');
  });

  it('sem perfil desempata pela avaliacao', () => {
    const a = { id: 10, name: 'A', average_rating: '4.10', pois: [] };
    const b = { id: 11, name: 'B', average_rating: '4.90', pois: [] };
    expect(pickSuggestedDestination([a, b], null, null, [])?.destination.name).toBe('B');
  });

  it('retorna null sem candidatos', () => {
    expect(pickSuggestedDestination([], culturalDna, null, [])).toBeNull();
  });
});
