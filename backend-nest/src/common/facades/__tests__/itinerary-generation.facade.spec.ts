import { InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { LlmQuotaError } from '../../../modules/ai/llm/llm.errors';
import { ItineraryGenerationFacade } from '../itinerary-generation.facade';
import { AiService } from '../../../modules/ai/ai.service';
import { Itinerary } from '../../../modules/itineraries/entities';
import { AuditService } from '../../../modules/audit/audit.service';

const noAudit = () => ({ log: jest.fn() }) as unknown as AuditService;

describe('ItineraryGenerationFacade', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('marca job e roteiro como failed quando a geracao quebra', async () => {
    const ai = {
      createJob: jest.fn().mockResolvedValue({ id: 7 }),
      runJob: jest.fn().mockRejectedValue(new Error('boom')),
      markJobFailed: jest.fn().mockResolvedValue(undefined),
    };
    const facade = new ItineraryGenerationFacade(ai as unknown as AiService, noAudit());

    const attempt = facade.generate({ id: 3 } as Itinerary, 1);

    await expect(attempt).rejects.toThrow(InternalServerErrorException);
    await expect(attempt).rejects.toThrow('Nao foi possivel gerar o roteiro. Tente novamente.');
    expect(ai.markJobFailed).toHaveBeenCalledWith(7, 3, 'boom');
  });

  it('devolve o job concluido quando tudo da certo', async () => {
    const job = { id: 7, status: 'completed' };
    const ai = { createJob: jest.fn().mockResolvedValue({ id: 7 }), runJob: jest.fn().mockResolvedValue(job), markJobFailed: jest.fn() };
    const facade = new ItineraryGenerationFacade(ai as unknown as AiService, noAudit());

    await expect(facade.generate({ id: 3 } as Itinerary, 1)).resolves.toBe(job);
    expect(ai.markJobFailed).not.toHaveBeenCalled();
  });

  it('cota da IA estourada vira 503 com mensagem clara', async () => {
    const ai = { createJob: jest.fn().mockResolvedValue({ id: 7 }), runJob: jest.fn().mockRejectedValue(new LlmQuotaError('429')), markJobFailed: jest.fn() };
    const attempt = new ItineraryGenerationFacade(ai as unknown as AiService, noAudit()).generate({ id: 3 } as Itinerary, 1);

    await expect(attempt).rejects.toThrow(ServiceUnavailableException);
    await expect(attempt).rejects.toThrow('O servico de IA atingiu o limite de uso. Tente novamente em alguns minutos.');
    expect(ai.markJobFailed).toHaveBeenCalledWith(7, 3, '429');
  });

  it('audita itinerary.generated com o job so quando a geracao conclui', async () => {
    const audit = { log: jest.fn() };
    const ai = { createJob: jest.fn().mockResolvedValue({ id: 7 }), runJob: jest.fn().mockResolvedValue({ id: 7, status: 'completed' }), markJobFailed: jest.fn() };
    await new ItineraryGenerationFacade(ai as unknown as AiService, audit as unknown as AuditService).generate({ id: 3 } as Itinerary, 1);
    expect(audit.log).toHaveBeenCalledWith({ event_type: 'itinerary.generated', actor_id: 1, content_type: 'Itinerary', object_id: '3', metadata: { job_id: 7 } });

    audit.log.mockClear();
    ai.runJob.mockResolvedValue({ id: 8, status: 'failed' });
    await new ItineraryGenerationFacade(ai as unknown as AiService, audit as unknown as AuditService).generate({ id: 3 } as Itinerary, 1);
    expect(audit.log).not.toHaveBeenCalled();

    ai.runJob.mockRejectedValue(new Error('boom'));
    await expect(new ItineraryGenerationFacade(ai as unknown as AiService, audit as unknown as AuditService).generate({ id: 3 } as Itinerary, 1)).rejects.toThrow();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
