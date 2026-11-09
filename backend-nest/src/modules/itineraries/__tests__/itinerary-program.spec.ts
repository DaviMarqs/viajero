import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PROGRAM_HISTORY_KEY,
  ProgramDaySource,
  ProgramEventSource,
  activityMinutes,
  applyProgramLayout,
  assertDatesMatchDuration,
  buildProgramSnapshot,
  metadataWithDetailsSnapshot,
  planProgramRestore,
  popProgramSnapshot,
  pushProgramSnapshot,
  readProgramHistory,
  tripDayCount,
  withoutProgramHistory,
} from '../itinerary-program';

// Ids como o TypeORM devolve (bigint -> string) e horarios como o Postgres devolve (HH:MM:SS).
function event(id: number, start: string | null, end: string | null, cost: string, extra: Partial<ProgramEventSource> = {}): ProgramEventSource {
  return { id: String(id), title: `Evento ${id}`, description: `Descricao ${id}`, estimated_cost: cost, order_index: 0, start_time: start, end_time: end, poi: null, ...extra };
}

function program(): ProgramDaySource[] {
  return [
    {
      id: '10', day_number: 1, title: 'Centro', summary: 'Dia 1', estimated_cost: '60.00',
      events: [
        event(1, '09:00:00', '10:00:00', '10.00', { order_index: 0, poi: { id: '7', estimated_visit_minutes: 60 } }),
        event(2, '10:30:00', '12:30:00', '20.00', { order_index: 1 }),
        event(3, '13:00:00', '14:00:00', '30.00', { order_index: 2 }),
      ],
    },
    { id: '20', day_number: 2, title: 'Praia', summary: 'Dia 2', estimated_cost: '15.50', events: [event(4, '10:00:00', '11:30:00', '15.50')] },
  ];
}

const itinerary = { title: 'Lisboa', start_date: '2026-11-10', end_date: '2026-11-11', budget_total: '75.50' };
const slots = (change: ReturnType<typeof applyProgramLayout>) =>
  change.events.map((item) => [item.id, item.day_id, item.order_index, item.start_time, item.end_time]);

describe('applyProgramLayout - layout invalido', () => {
  const cases: Array<[string, { day_number: number; event_ids: Array<number | string> }[], RegExp]> = [
    ['falta um dia', [{ day_number: 1, event_ids: [1, 2, 3, 4] }], /Falta o dia 2/],
    ['dia inexistente', [{ day_number: 1, event_ids: [1, 2, 3] }, { day_number: 2, event_ids: [4] }, { day_number: 3, event_ids: [] }], /dia 3 nao existe/],
    ['dia repetido', [{ day_number: 1, event_ids: [1, 2, 3] }, { day_number: 1, event_ids: [4] }], /dia 1 aparece mais de uma vez/],
    ['evento de outro roteiro', [{ day_number: 1, event_ids: [1, 2, 3, 99] }, { day_number: 2, event_ids: [4] }], /atividade 99 nao pertence/],
    ['evento repetido', [{ day_number: 1, event_ids: [1, 2, 3] }, { day_number: 2, event_ids: [4, 1] }], /atividade 1 aparece mais de uma vez/],
    ['id que nao e numero', [{ day_number: 1, event_ids: ['abc'] }, { day_number: 2, event_ids: [] }], /atividade abc nao pertence/],
  ];

  it.each(cases)('%s -> 400', (_label, days, message) => {
    expect(() => applyProgramLayout(program(), { days })).toThrow(BadRequestException);
    expect(() => applyProgramLayout(program(), { days })).toThrow(message);
  });

  it('sem lista de dias -> 400', () => {
    expect(() => applyProgramLayout(program(), {} as never)).toThrow(BadRequestException);
  });
});

describe('applyProgramLayout - edicao', () => {
  it('reordena dentro do dia recalculando horarios a partir do inicio original do dia', () => {
    const change = applyProgramLayout(program(), { days: [{ day_number: 1, event_ids: [3, '1', 2] }, { day_number: 2, event_ids: [4] }] });
    expect(slots(change)).toEqual([
      [3, 10, 0, '09:00', '10:00'],
      [1, 10, 1, '10:30', '11:30'],
      [2, 10, 2, '12:00', '14:00'],
      [4, 20, 0, '10:00', '11:30'],
    ]);
    expect(change.removed_event_ids).toEqual([]);
    expect(change.days).toEqual([{ id: 10, estimated_cost: '60.00' }, { id: 20, estimated_cost: '15.50' }]);
    expect(change.budget_total).toBe('75.50');
  });

  it('move entre dias: o evento vai para o fim do outro dia e os custos acompanham', () => {
    const change = applyProgramLayout(program(), { days: [{ day_number: 1, event_ids: [1, 3] }, { day_number: 2, event_ids: [4, 2] }] });
    expect(slots(change)).toEqual([
      [1, 10, 0, '09:00', '10:00'],
      [3, 10, 1, '10:30', '11:30'],
      [4, 20, 0, '10:00', '11:30'],
      [2, 20, 1, '12:00', '14:00'],
    ]);
    expect(change.days).toEqual([{ id: 10, estimated_cost: '40.00' }, { id: 20, estimated_cost: '35.50' }]);
    expect(change.budget_total).toBe('75.50');
  });

  it('remove eventos ausentes do layout e recalcula dia e total', () => {
    const change = applyProgramLayout(program(), { days: [{ day_number: 1, event_ids: [2, 3] }, { day_number: 2, event_ids: [] }] });
    expect(change.removed_event_ids).toEqual([1, 4]);
    expect(slots(change)).toEqual([
      [2, 10, 0, '09:00', '11:00'],
      [3, 10, 1, '11:30', '12:30'],
    ]);
    expect(change.days).toEqual([{ id: 10, estimated_cost: '50.00' }, { id: 20, estimated_cost: '0.00' }]);
    expect(change.budget_total).toBe('50.00');
  });

  it('soma custos em centavos, sem erro de ponto flutuante', () => {
    const days = program();
    days[0].events = [event(1, null, null, '0.10'), event(2, null, null, '0.20')];
    days[1].events = [event(3, null, null, '0.70')];
    const change = applyProgramLayout(days, { days: [{ day_number: 1, event_ids: [1, 2] }, { day_number: 2, event_ids: [3] }] });
    expect(change.days.map((day) => day.estimated_cost)).toEqual(['0.30', '0.70']);
    expect(change.budget_total).toBe('1.00');
  });
});

describe('horarios', () => {
  it('duracao: fim - inicio, senao minutos do POI, senao 90', () => {
    expect(activityMinutes({ start_time: '09:00:00', end_time: '10:15:00', poi: { id: 1, estimated_visit_minutes: 30 } })).toBe(75);
    expect(activityMinutes({ start_time: null, end_time: null, poi: { id: 1, estimated_visit_minutes: 45 } })).toBe(45);
    expect(activityMinutes({ start_time: '10:00', end_time: '09:00', poi: null })).toBe(90);
    expect(activityMinutes({ start_time: null, end_time: null, poi: { id: 1, estimated_visit_minutes: 0 } })).toBe(90);
  });

  it('dia sem horario original comeca as 09:00', () => {
    const days = program();
    days[1].events = [event(4, null, null, '1.00', { poi: { id: 2, estimated_visit_minutes: 45 } }), event(5, null, null, '1.00')];
    const change = applyProgramLayout(days, { days: [{ day_number: 1, event_ids: [1, 2, 3] }, { day_number: 2, event_ids: [5, 4] }] });
    expect(slots(change).slice(3)).toEqual([
      [5, 20, 0, '09:00', '10:30'],
      [4, 20, 1, '11:00', '11:45'],
    ]);
  });

  it('dia vazio que recebe atividade comeca as 09:00', () => {
    const days = program();
    days[1].events = [];
    const change = applyProgramLayout(days, { days: [{ day_number: 1, event_ids: [1, 2] }, { day_number: 2, event_ids: [3] }] });
    expect(slots(change)[2]).toEqual([3, 20, 0, '09:00', '10:00']);
  });

  it('passar da meia-noite -> 400 sem aplicar nada', () => {
    const days = program();
    days[1].events = [event(4, '22:00:00', '23:30:00', '1.00')];
    const layout = { days: [{ day_number: 1, event_ids: [1, 3] }, { day_number: 2, event_ids: [4, 2] }] };
    expect(() => applyProgramLayout(days, layout)).toThrow(BadRequestException);
    expect(() => applyProgramLayout(days, layout)).toThrow('As atividades do dia 2 passam da meia-noite. Remova ou mova uma atividade.');
  });

  it('terminar exatamente antes da meia-noite e permitido', () => {
    const days = program();
    days[1].events = [event(4, '22:00:00', '23:59:00', '1.00')];
    expect(() => applyProgramLayout(days, { days: [{ day_number: 1, event_ids: [1, 2, 3] }, { day_number: 2, event_ids: [4] }] })).not.toThrow();
  });
});

describe('historico (Memento)', () => {
  it('snapshot guarda nome, datas, total e eventos completos com poi_id', () => {
    const snapshot = buildProgramSnapshot(itinerary, program());
    expect(snapshot).toMatchObject({ title: 'Lisboa', start_date: '2026-11-10', end_date: '2026-11-11', budget_total: '75.50' });
    expect(snapshot.days[0]).toMatchObject({ day_number: 1, title: 'Centro', summary: 'Dia 1', estimated_cost: '60.00' });
    expect(snapshot.days[0].events[0]).toEqual({
      id: 1, title: 'Evento 1', description: 'Descricao 1', estimated_cost: '10.00', order_index: 0, start_time: '09:00:00', end_time: '10:00:00', poi_id: 7,
    });
  });

  it('mantem no maximo 10 snapshots, o mais novo por ultimo, sem perder o resto do metadata', () => {
    let metadata: Record<string, unknown> = { trip_preferences: { budget_min: 1 }, title_customized: true };
    for (let index = 1; index <= 12; index += 1) metadata = pushProgramSnapshot(metadata, { ...buildProgramSnapshot(itinerary, program()), title: `v${index}` });
    const history = readProgramHistory(metadata);
    expect(history).toHaveLength(10);
    expect(history[0].title).toBe('v3');
    expect(history[9].title).toBe('v12');
    expect(metadata.trip_preferences).toEqual({ budget_min: 1 });

    const popped = popProgramSnapshot(metadata);
    expect(popped?.snapshot.title).toBe('v12');
    expect(readProgramHistory(popped?.metadata)).toHaveLength(9);
    expect(popped?.metadata.title_customized).toBe(true);
  });

  it('sem historico nao ha o que desfazer; lixo no metadata e ignorado', () => {
    expect(popProgramSnapshot({})).toBeNull();
    expect(popProgramSnapshot(null)).toBeNull();
    expect(readProgramHistory({ [PROGRAM_HISTORY_KEY]: [null, 'x', { title: 1 }] })).toEqual([]);
  });

  it('geracao completa limpa o historico', () => {
    const metadata = pushProgramSnapshot({ is_template: false }, buildProgramSnapshot(itinerary, program()));
    expect(withoutProgramHistory(metadata)).toEqual({ is_template: false });
  });

  it('PATCH so guarda snapshot quando muda nome ou datas de um roteiro pronto', () => {
    const ready = { ...itinerary, generation_status: 'ready', metadata: {}, days: program() };
    expect(metadataWithDetailsSnapshot(ready, { title: 'Lisboa', start_date: '2026-11-10', end_date: '2026-11-11' })).toBeNull();
    expect(metadataWithDetailsSnapshot({ ...ready, generation_status: 'draft' }, { title: 'Outro', start_date: null, end_date: null })).toBeNull();
    const renamed = metadataWithDetailsSnapshot(ready, { title: 'Lisboa a dois', start_date: '2026-11-10', end_date: '2026-11-11' }, { title_customized: true });
    expect(renamed?.title_customized).toBe(true);
    expect(readProgramHistory(renamed)[0].title).toBe('Lisboa');
    const moved = metadataWithDetailsSnapshot(ready, { title: 'Lisboa', start_date: '2026-12-01', end_date: '2026-12-02' });
    expect(readProgramHistory(moved)[0].start_date).toBe('2026-11-10');
  });
});

describe('planProgramRestore', () => {
  it('atualiza quem existe, recria quem foi removido e apaga quem nao estava no snapshot', () => {
    const snapshot = buildProgramSnapshot(itinerary, program());
    // Estado atual: evento 1 removido, evento 2 movido para o dia 2 e um evento 99 que nao existia.
    const current = program();
    current[0].events = [event(3, '09:00:00', '10:00:00', '30.00'), event(99, null, null, '5.00')];
    current[0].estimated_cost = '35.00';
    current[1].events = [event(4, '10:00:00', '11:30:00', '15.50'), event(2, '12:00:00', '14:00:00', '20.00', { order_index: 1 })];

    const plan = planProgramRestore(current, snapshot);
    expect(plan.updates.map((item) => [item.id, item.day_id, item.fields.order_index, item.fields.start_time])).toEqual([
      [2, 10, 1, '10:30:00'],
      [3, 10, 2, '13:00:00'],
      [4, 20, 0, '10:00:00'],
    ]);
    expect(plan.creates).toEqual([
      { day_id: 10, fields: { title: 'Evento 1', description: 'Descricao 1', estimated_cost: '10.00', order_index: 0, start_time: '09:00:00', end_time: '10:00:00', poi_id: 7 } },
    ]);
    expect(plan.deletes).toEqual([99]);
    expect(plan.days).toEqual([
      { id: 10, title: 'Centro', summary: 'Dia 1', estimated_cost: '60.00' },
      { id: 20, title: 'Praia', summary: 'Dia 2', estimated_cost: '15.50' },
    ]);
    expect(plan.itinerary).toEqual({ title: 'Lisboa', start_date: '2026-11-10', end_date: '2026-11-11', budget_total: '75.50' });
  });

  it('dias diferentes do snapshot -> 409', () => {
    const snapshot = buildProgramSnapshot(itinerary, program());
    expect(() => planProgramRestore(program().slice(0, 1), snapshot)).toThrow(ConflictException);
  });
});

describe('datas x duracao', () => {
  it('conta ida e volta, inclusive na virada de mes e em ano bissexto', () => {
    expect(tripDayCount('2026-11-10', '2026-11-13')).toBe(4);
    expect(tripDayCount('2028-02-28', '2028-03-01')).toBe(3);
    expect(tripDayCount('2026-10-10', '2026-10-10')).toBe(1);
  });

  it('datas que nao cobrem a duracao -> 400; sem uma das datas passa', () => {
    expect(() => assertDatesMatchDuration('2026-11-10', '2026-11-13', 4)).not.toThrow();
    expect(() => assertDatesMatchDuration('2026-11-10', '2026-11-12', 4)).toThrow('As datas precisam cobrir exatamente 4 dias.');
    expect(() => assertDatesMatchDuration('2026-11-10', '2026-11-11', 1)).toThrow('As datas precisam cobrir exatamente 1 dia.');
    expect(() => assertDatesMatchDuration('2026-11-10', null, 4)).not.toThrow();
    expect(() => assertDatesMatchDuration(null, null, 4)).not.toThrow();
  });
});
