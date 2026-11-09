import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FavoritesService } from '../favorites.service';
import { SharedLinksService } from '../shared-links.service';
import { canViewReview, ReviewsService } from '../reviews.service';

describe('FavoritesService (so o dono)', () => {
  const favorites = { findOne: jest.fn(), exists: jest.fn(), update: jest.fn() };
  const itineraries = { findVisibleForUser: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new FavoritesService(favorites as never, itineraries as never, audit as never);

  beforeEach(() => jest.resetAllMocks());

  it('detalhe filtra pelo dono e responde 404 para favorito de outro usuario', async () => {
    favorites.findOne.mockResolvedValue(null);
    await expect(service.findOwned(3, 9)).rejects.toThrow(new NotFoundException('Favorito nao encontrado.'));
    expect(favorites.findOne).toHaveBeenCalledWith({ where: { id: 9, user: { id: 3 } }, relations: { itinerary: { destination: true } } });
  });

  it('trocar para roteiro invisivel responde 404 e nao grava', async () => {
    favorites.findOne.mockResolvedValue({ id: 9, itinerary: { id: '1' } });
    itineraries.findVisibleForUser.mockRejectedValue(new NotFoundException('Roteiro nao encontrado.'));
    await expect(service.update(3, 9, { itinerary: 2 })).rejects.toBeInstanceOf(NotFoundException);
    expect(favorites.update).not.toHaveBeenCalled();
  });

  it('trocar para roteiro ja favoritado responde 409', async () => {
    favorites.findOne.mockResolvedValue({ id: 9, itinerary: { id: '1' } });
    favorites.exists.mockResolvedValue(true);
    await expect(service.update(3, 9, { itinerary: 2 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('troca o roteiro e audita; mesmo roteiro nao grava', async () => {
    favorites.findOne.mockResolvedValue({ id: 9, itinerary: { id: '1' } });
    favorites.exists.mockResolvedValue(false);
    await service.update(3, 9, { itinerary: 2 });
    expect(favorites.update).toHaveBeenCalledWith({ id: 9 }, { itinerary: { id: 2 } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'favorite.updated', metadata: { from_itinerary_id: 1, itinerary_id: 2 } }));

    favorites.update.mockClear();
    await service.update(3, 9, { itinerary: 1 });
    expect(favorites.update).not.toHaveBeenCalled();
  });
});

describe('SharedLinksService (so quem criou)', () => {
  const links = { findOne: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const itineraries = { findVisibleForUser: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new SharedLinksService(links as never, itineraries as never, audit as never);

  beforeEach(() => jest.resetAllMocks());

  it('filtra pelo criador', async () => {
    links.findOne.mockResolvedValue(null);
    await expect(service.findOwned(3, 9)).rejects.toThrow('Link compartilhado nao encontrado.');
    expect(links.findOne).toHaveBeenCalledWith({ where: { id: 9, created_by: { id: 3 } }, relations: { itinerary: true } });
    await expect(service.remove(3, 9)).rejects.toBeInstanceOf(NotFoundException);
    expect(links.delete).not.toHaveBeenCalled();
  });

  it('atualiza expiracao (null limpa) e ativo, sem trocar o token', async () => {
    links.findOne.mockResolvedValue({ id: 9, token: 'abc', itinerary: { id: '1' } });
    await service.update(3, 9, { expires_at: null, is_active: false, itinerary: 1 });
    expect(links.update).toHaveBeenCalledWith({ id: 9 }, { expires_at: null, is_active: false });
    expect(itineraries.findVisibleForUser).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'itinerary.share_updated', metadata: { token: 'abc', fields: ['expires_at', 'is_active'] } }));
  });

  it('trocar o roteiro exige que o usuario possa ve-lo', async () => {
    links.findOne.mockResolvedValue({ id: 9, token: 'abc', itinerary: { id: '1' } });
    itineraries.findVisibleForUser.mockRejectedValue(new NotFoundException('Roteiro nao encontrado.'));
    await expect(service.update(3, 9, { itinerary: 5 })).rejects.toBeInstanceOf(NotFoundException);
    expect(itineraries.findVisibleForUser).toHaveBeenCalledWith(5, 3);
    expect(links.update).not.toHaveBeenCalled();
  });

  it('remove e audita itinerary.unshared', async () => {
    links.findOne.mockResolvedValue({ id: 9, token: 'abc', itinerary: { id: '1' } });
    await service.remove(3, 9);
    expect(links.delete).toHaveBeenCalledWith({ id: 9 });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'itinerary.unshared', object_id: '1' }));
  });
});

describe('avaliacoes: detalhe e PUT', () => {
  const ready = (count: number) => ({ generation_status: 'ready', metadata: {}, review_stats: { review_count: count } });

  it('canViewReview: autor sempre; os demais so com roteiro visivel', () => {
    const review = { user: { id: 4 }, itinerary: { ...ready(0), generation_status: 'generating' } };
    expect(canViewReview(review, 4, false)).toBe(true);
    expect(canViewReview(review, 5, false)).toBe(false);
    expect(canViewReview(review, null, false)).toBe(false);
    expect(canViewReview(review, 6, true)).toBe(true);
    expect(canViewReview({ user: { id: 4 }, itinerary: ready(1) }, null, false)).toBe(true);
  });

  const reviews = { findOne: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn(), findOneOrFail: jest.fn() };
  const stats = { findOne: jest.fn(), save: jest.fn(), create: jest.fn((value) => value) };
  const itineraries = { exists: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new ReviewsService(reviews as never, stats as never, itineraries as never, audit as never);

  beforeEach(() => {
    jest.resetAllMocks();
    stats.create.mockImplementation((value) => value);
  });

  it('GET /:id de roteiro privado responde 404 para anonimo', async () => {
    reviews.findOne.mockResolvedValue({ id: 1, user: { id: 4 }, itinerary: { id: 2, ...ready(0), generation_status: 'failed' } });
    await expect(service.findVisible(1, null)).rejects.toThrow('Avaliacao nao encontrada.');
    expect(itineraries.exists).not.toHaveBeenCalled();
  });

  it('GET /:id de roteiro publico devolve a avaliacao sem dados sensiveis', async () => {
    reviews.findOne.mockResolvedValue({ id: 1, rating: 5, title: '', body: '', user: { id: 4, display_name: 'Ana', email: 'a@x', password: 'p', avatar_url: '' }, itinerary: { id: 2, ...ready(1) } });
    itineraries.exists.mockResolvedValue(false);
    const presented = await service.findVisible(1, 9);
    expect(presented).toMatchObject({ id: 1, itinerary: 2, user: { id: 4, display_name: 'Ana' } });
    expect(JSON.stringify(presented)).not.toMatch(/password|email/);
  });

  it('PUT so do autor e sem mover para outro roteiro', async () => {
    reviews.findOne.mockResolvedValue(null);
    await expect(service.replace(3, 1, { rating: 4 })).rejects.toBeInstanceOf(NotFoundException);
    expect(reviews.findOne).toHaveBeenCalledWith({ where: { id: 1, user: { id: 3 } }, relations: { itinerary: true } });

    reviews.findOne.mockResolvedValue({ id: 1, rating: 2, title: 'a', body: 'b', itinerary: { id: '2' } });
    await expect(service.replace(3, 1, { rating: 4, itinerary: 7 })).rejects.toBeInstanceOf(BadRequestException);
    expect(reviews.save).not.toHaveBeenCalled();
  });

  it('PUT recalcula a estatistica e audita review.updated', async () => {
    reviews.findOne.mockResolvedValue({ id: 1, rating: 2, title: 'a', body: 'b', itinerary: { id: '2' } });
    const qb = { select: () => qb, addSelect: () => qb, where: () => qb, getRawOne: async () => ({ count: '2', average: '3.5' }) };
    reviews.createQueryBuilder.mockReturnValue(qb);
    reviews.findOneOrFail.mockResolvedValue({ id: 1, rating: 5, title: 'novo', body: 'b', user: { id: 3, display_name: 'Eu', avatar_url: '' }, itinerary: { id: 2 } });
    await service.replace(3, 1, { rating: 5, title: ' novo ', itinerary: 2 });
    expect(reviews.save).toHaveBeenCalledWith(expect.objectContaining({ rating: 5, title: 'novo', body: 'b' }));
    expect(stats.save).toHaveBeenCalledWith(expect.objectContaining({ review_count: 2, average_rating: '3.50' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'review.updated', actor_id: 3 }));
  });
});
