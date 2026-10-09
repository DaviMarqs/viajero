import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ItineraryGenerationFacade } from '../itinerary-generation.facade';
import { AiService } from '../../../modules/ai/ai.service';
import { Itinerary } from '../../../modules/itineraries/entities';

describe('ItineraryGenerationFacade', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('marca job e roteiro como failed quando a geracao quebra', async () => {
    const ai = {
      createJob: jest.fn().mockResolvedValue({ id: 7 }),
      runJob: jest.fn().mockRejectedValue(new Error('boom')),
      markJobFailed: jest.fn().mockResolvedValue(undefined),
    };
    const facade = new ItineraryGenerationFacade(ai as unknown as AiService);

    const attempt = facade.generate({ id: 3 } as Itinerary, 1);

    await expect(attempt).rejects.toThrow(InternalServerErrorException);
    await expect(attempt).rejects.toThrow('Nao foi possivel gerar o roteiro. Tente novamente.');
    expect(ai.markJobFailed).toHaveBeenCalledWith(7, 3, 'boom');
  });

  it('devolve o job concluido quando tudo da certo', async () => {
    const job = { id: 7, status: 'completed' };
    const ai = { createJob: jest.fn().mockResolvedValue({ id: 7 }), runJob: jest.fn().mockResolvedValue(job), markJobFailed: jest.fn() };
    const facade = new ItineraryGenerationFacade(ai as unknown as AiService);

    await expect(facade.generate({ id: 3 } as Itinerary, 1)).resolves.toBe(job);
    expect(ai.markJobFailed).not.toHaveBeenCalled();
  });
});
