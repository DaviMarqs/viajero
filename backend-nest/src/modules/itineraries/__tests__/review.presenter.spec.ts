import { presentReview } from '../review.presenter';
import { Review } from '../entities';

const createdAt = new Date('2026-10-01T10:00:00Z');

function review(user: Partial<Review['user']>): Review {
  return {
    id: 5,
    rating: 4,
    title: 'Bom',
    body: 'Gostei',
    created_at: createdAt,
    updated_at: createdAt,
    itinerary: { id: 9 } as Review['itinerary'],
    user: { id: 2, display_name: 'Ana', first_name: 'Ana', username: 'ana', avatar_url: '', ...user } as Review['user'],
  } as Review;
}

describe('presentReview', () => {
  it('expoe so dados publicos do autor', () => {
    const presented = presentReview(review({ email: 'ana@x.dev', password: 'pbkdf2_sha256$1$a$b', is_staff: true }));

    expect(presented).toEqual({
      id: 5,
      itinerary: 9,
      rating: 4,
      title: 'Bom',
      body: 'Gostei',
      created_at: createdAt,
      updated_at: createdAt,
      user: { id: 2, display_name: 'Ana', avatar_url: '' },
    });
    expect(JSON.stringify(presented)).not.toMatch(/password|email|pbkdf2|is_staff/);
  });

  it('usa first_name ou username quando nao ha display_name', () => {
    expect(presentReview(review({ display_name: '', first_name: 'Ana' })).user.display_name).toBe('Ana');
    expect(presentReview(review({ display_name: '', first_name: '' })).user.display_name).toBe('ana');
  });
});
