import { matchesDestinationPlace } from '../destination-language';

const bologna = { name: 'Bologna', city: 'Bologna', country: 'Itália', summary: "Capital da Emília-Romanha, a 'Cidade Vermelha'.", pois: [{ tags: [{ name: 'Romântico' }] }] };
const rome = { name: 'Rome', city: 'Rome', country: 'Italy', summary: '' };
const rio = { name: 'Rio de Janeiro', city: 'Rio de Janeiro', country: 'Brasil', summary: '' };

describe('matchesDestinationPlace', () => {
  it('nao casa com resumo nem tags (Roma x Emilia-Romanha)', () => {
    expect(matchesDestinationPlace(bologna, 'Roma')).toBe(false);
    expect(matchesDestinationPlace(bologna, 'vermelha')).toBe(false);
  });

  it('casa pelo nome original ou em portugues, sem acento e por inicio de palavra', () => {
    expect(matchesDestinationPlace(rome, 'Roma')).toBe(true);
    expect(matchesDestinationPlace(bologna, 'bolo')).toBe(true);
    expect(matchesDestinationPlace(rio, 'rio janeiro')).toBe(true);
    expect(matchesDestinationPlace(bologna, 'ITALIA')).toBe(true);
  });

  it('nao casa com pedaco no meio da palavra nem com busca vazia', () => {
    expect(matchesDestinationPlace(bologna, 'logna')).toBe(false);
    expect(matchesDestinationPlace(bologna, '  ')).toBe(false);
  });
});
