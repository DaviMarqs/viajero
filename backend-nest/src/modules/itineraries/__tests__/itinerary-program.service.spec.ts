import { ConflictException, NotFoundException } from '@nestjs/common';
import { ItineraryProgramService } from '../itinerary-program.service';
import { Itinerary, ItineraryDailyEvent, ItineraryDay } from '../entities';
import { buildProgramSnapshot, pushProgramSnapshot, readProgramHistory } from '../itinerary-program';

function days() {
  return [
    {
      id: '10', day_number: 1, title: 'Centro', summary: '', estimated_cost: '30.00',
      events: [
        { id: '1', title: 'Museu', description: '', estimated_cost: '10.00', order_index: 0, start_time: '09:00:00', end_time: '10:00:00', poi: { id: '7', estimated_visit_minutes: 60 } },
        { id: '2', title: 'Mirante', description: '', estimated_cost: '20.00', order_index: 1, start_time: '10:30:00', end_time: '11:30:00', poi: null },
      ],
    },
    { id: '20', day_number: 2, title: 'Praia', summary: '', estimated_cost: '0.00', events: [] },
  ];
}

function setup(itinerary: Record<string, unknown>, options: { pois?: Array<{ id: string }> } = {}) {
  const manager = {
    findOne: jest.fn().mockResolvedValue(itinerary),
    find: jest.fn((entity: unknown) => Promise.resolve(entity === ItineraryDay ? days() : options.pois ?? [])),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((_entity: unknown, values: unknown) => values),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const repository = { manager: { transaction: (work: (value: typeof manager) => unknown) => work(manager) } };
  const queries = { findForUser: jest.fn().mockResolvedValue({ id: 5, title: 'Lisboa' }) };
  const audit = { log: jest.fn() };
  const service = new ItineraryProgramService(repository as never, queries as never, audit as never);
  return { service, manager, queries, audit };
}

const ready = () => ({ id: 5, title: 'Lisboa', start_date: null, end_date: null, budget_total: '30.00', generation_status: 'ready', metadata: { title_customized: true } });

describe('ItineraryProgramService', () => {
  it('quem nao e dono recebe 404 antes de qualquer escrita', async () => {
    const { service, manager, queries } = setup(ready());
    queries.findForUser.mockRejectedValue(new NotFoundException('Roteiro nao encontrado.'));
    await expect(service.updateProgram(5, 3, { days: [] })).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.findOne).not.toHaveBeenCalled();
  });

  it('roteiro que nao esta pronto -> 409', async () => {
    const { service, manager } = setup({ ...ready(), generation_status: 'generating' });
    await expect(service.updateProgram(5, 3, { days: [] })).rejects.toBeInstanceOf(ConflictException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('aplica o layout com o roteiro travado, guarda o snapshot e audita', async () => {
    const { service, manager, audit } = setup(ready());
    await service.updateProgram(5, 3, { days: [{ day_number: 1, event_ids: [] }, { day_number: 2, event_ids: [2] }] });

    expect(manager.findOne).toHaveBeenCalledWith(Itinerary, { where: { id: 5 }, lock: { mode: 'pessimistic_write' } });
    expect(manager.delete).toHaveBeenCalledWith(ItineraryDailyEvent, [1]);
    expect(manager.update).toHaveBeenCalledWith(ItineraryDailyEvent, { id: 2 }, { itinerary_day: { id: 20 }, order_index: 0, start_time: '09:00', end_time: '10:00' });
    expect(manager.update).toHaveBeenCalledWith(ItineraryDay, { id: 10 }, { estimated_cost: '0.00' });
    expect(manager.update).toHaveBeenCalledWith(ItineraryDay, { id: 20 }, { estimated_cost: '20.00' });
    const itineraryUpdate = manager.update.mock.calls.find(([entity]) => entity === Itinerary);
    expect(itineraryUpdate?.[2].budget_total).toBe('20.00');
    expect(itineraryUpdate?.[2].metadata.title_customized).toBe(true);
    expect(readProgramHistory(itineraryUpdate?.[2].metadata)[0].days[0].events.map((event: { id: number }) => event.id)).toEqual([1, 2]);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'itinerary.program_updated', actor_id: 3, object_id: '5' }));
  });

  it('desfazer sem historico -> 409', async () => {
    const { service, audit } = setup(ready());
    await expect(service.undoProgram(5, 3)).rejects.toThrow('Nao ha alteracoes para desfazer.');
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('desfazer recria eventos removidos (sem POI apagado), restaura nome e tira o snapshot', async () => {
    const snapshot = buildProgramSnapshot({ title: 'Nome antigo', start_date: '2026-11-10', end_date: '2026-11-11', budget_total: '45.00' }, [
      { ...days()[0], events: [...days()[0].events, { id: '3', title: 'Feira', description: '', estimated_cost: '15.00', order_index: 2, start_time: '12:00:00', end_time: '13:00:00', poi: { id: '8', estimated_visit_minutes: 60 } }] },
      days()[1],
    ]);
    const { service, manager, audit } = setup({ ...ready(), metadata: pushProgramSnapshot({}, snapshot) }, { pois: [{ id: '7' }] });
    await service.undoProgram(5, 3);

    expect(manager.update).toHaveBeenCalledWith(ItineraryDailyEvent, { id: 1 }, expect.objectContaining({ itinerary_day: { id: 10 }, poi: { id: 7 } }));
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Feira', itinerary_day: { id: 10 }, poi: null, order_index: 2 }));
    expect(manager.delete).not.toHaveBeenCalled();
    const itineraryUpdate = manager.update.mock.calls.find(([entity]) => entity === Itinerary);
    expect(itineraryUpdate?.[2]).toMatchObject({ title: 'Nome antigo', start_date: '2026-11-10', end_date: '2026-11-11', budget_total: '45.00' });
    expect(readProgramHistory(itineraryUpdate?.[2].metadata)).toEqual([]);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'itinerary.program_undone', metadata: expect.objectContaining({ recreated_events: 1 }) }));
  });
});
