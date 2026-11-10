import { tripMilestones } from "../src/features/itineraries/trip-milestones.ts";
import { collectionPagination } from "../src/lib/collection-pagination.ts";
import { readFileSync } from "node:fs";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { localizedDestination, matchesDestinationQuery } from "../src/lib/destination-language.ts";
import { scheduleItineraryDays } from "../src/features/itineraries/itinerary-schedule.ts";
import { tripDuration, parseTripDate, selectTripRange } from "../src/lib/trip-dates.ts";
import { readPlanningDraft, savePlanningDraft, clearPlanningDraft, planningDraftKey } from "../src/lib/planning-draft.ts";
import { filterDestinations } from "../src/lib/destination-filters.ts";
import { destinationRecommendationReason } from "../src/lib/personalization.ts";
import { dayInsights } from "../src/features/itineraries/itinerary-insights.ts";
import { convertAmount } from "../src/lib/currency.ts";
import {
  destinationCategories,
  rankDestinations,
} from "../src/lib/personalization.ts";
import { tripHasEnded } from "../src/features/itineraries/itinerary-editing.ts";
import {
  applyProgram,
  clearLegacyPrograms,
  createSaveQueue,
  moveEvent,
  programHistorySize,
  programLayout,
  removeEvent,
  reorderEvent,
  tripEndDate,
} from "../src/features/itineraries/program-sync.ts";

const storage = new Map();
test("category pagination tracks quarters with at most five reachable markers", () => {
  const positions = Array.from({ length: 21 }, (_, index) => index * 100);
  assert.deepEqual(collectionPagination(positions, 0), { indexes: [0, 5, 10, 15, 20], active: 0 });
  for (const [offset, active] of [[499, 0], [500, 1], [999, 1], [1000, 2], [1500, 3], [1998, 4], [2000, 4]]) {
    assert.equal(collectionPagination(positions, offset).active, active);
  }
  assert.deepEqual(collectionPagination([], 0), { indexes: [0], active: 0 });
  assert.deepEqual(collectionPagination([0], 0), { indexes: [0], active: 0 });
  assert.deepEqual(collectionPagination([0, 100], 100), { indexes: [0, 1], active: 1 });
  assert.deepEqual(collectionPagination([0, 100, 200], 100), { indexes: [0, 1, 2], active: 1 });
  assert.equal(collectionPagination([0, 100, 200, 300, 400, 450], 450).active, 4);
  assert.equal(collectionPagination([0, 100], 2000).active, 1);
  assert.equal(collectionPagination(positions, -10).active, 0);
});
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
  get length() { return storage.size; },
  key: (index) => [...storage.keys()][index] ?? null,
};
beforeEach(() => storage.clear());
test("calendar counts inclusive dates across month, leap year and daylight saving boundaries", () => {
  assert.equal(tripDuration("2028-02-28", "2028-03-01"), 3);
  assert.equal(tripDuration("2026-03-07", "2026-03-09"), 3);
  assert.equal(tripDuration("2026-10-10", "2026-10-10"), 1);
  assert.equal(tripDuration("2026-10-11", "2026-10-10"), null);
  assert.equal(parseTripDate("2026-02-30"), null);
  assert.deepEqual(selectTripRange("2026-10-20", "", "2026-10-10"), { start: "2026-10-10", end: "" });
  assert.deepEqual(selectTripRange("2026-10-10", "", "2026-10-15"), { start: "2026-10-10", end: "2026-10-15" });
});
test("planning draft survives reload, isolates accounts and expires after 30 days", () => {
  const value = { destination: { id: 3, name: "Rio" }, snapshot: { currentIndex: 2, fieldValues: { start_date: "2026-10-10" }, cardSelections: { timing: [1] }, tagValues: {} } };
  assert.equal(savePlanningDraft(1, value), true);
  assert.deepEqual(readPlanningDraft(1), value);
  assert.equal(readPlanningDraft(2), null);
  localStorage.setItem(planningDraftKey(1), JSON.stringify({ version: 1, updatedAt: Date.now() - 31 * 86400000, value }));
  assert.equal(readPlanningDraft(1), null);
  savePlanningDraft(1, value);
  clearPlanningDraft(1);
  assert.equal(readPlanningDraft(1), null);
  localStorage.setItem(planningDraftKey(1), "invalid JSON");
  assert.equal(readPlanningDraft(1), null);
});
test("combined filters match Portuguese names, country and every selected experience", () => {
  const rio = { id: 1, name: "Rio", country: "Brasil", tags: ["Natureza", "Família"] };
  const tokyo = localizedDestination({ id: 2, name: "Tokyo", country: "Japan", tags: ["Família", "Compras"] });
  assert.deepEqual(filterDestinations([rio, tokyo], "Toquio", "Japão", ["Família", "Compras"]).map(item => item.id), [2]);
  assert.equal(filterDestinations([rio, tokyo], "", "", ["Natureza", "Compras"]).length, 0);
  assert.deepEqual(filterDestinations([rio, tokyo], "familia", "Brasil", []).map(item => item.id), [1]);
});
test("recommendation explanations require real categories and strong DNA interests", () => {
  assert.equal(destinationRecommendationReason({ id: 1, name: "Rio", tags: ["Natureza"] }, { nature_interest: 9 }), "Combina com seu interesse em natureza.");
  assert.equal(destinationRecommendationReason({ id: 1, name: "Rio", tags: ["Natureza"] }, { nature_interest: 2 }).includes("Combina"), false);
  assert.equal(destinationRecommendationReason({ id: 1, name: "Rio" }, { nature_interest: 9 }).includes("insuficientes"), true);
});
test("day overview distinguishes unknown cost and duration from zero", () => {
  const overview = dayInsights({ events: [{ id: 1, title: "A", estimated_cost: 0, start_time: "09:00", end_time: "10:00" }, { id: 2, title: "B", estimated_cost: null }] });
  assert.deepEqual(overview, { activities: 2, visitMinutes: 60, missingDurations: 1, knownCost: 0, missingCosts: 1 });
});
const trip = {
  id: 1,
  title: "Viagem",
  days: [
    {
      id: 10,
      title: "Dia 1",
      day_number: 1,
      events: [
        { id: 11, title: "Praia" },
        { id: 12, title: "Museu" },
      ],
    },
  ],
};
test("Portuguese destination search preserves English aliases and identity", () => {
  const destination = localizedDestination({ id: 55, name: "Tokyo", city: "Tokyo", country: "Japan" });
  assert.equal(destination.id, 55);
  assert.equal(destination.name, "Tóquio");
  for (const query of ["Tokyo", "Toquio", "Tóquio", "Japão", "Japao", "Japan"]) assert.equal(matchesDestinationQuery(destination, query), true);
  assert.equal(matchesDestinationQuery(destination, "Lisboa"), false);
});
test("saving reordered activities restores backend names and recalculates their durations", () => {
  const source = { ...trip, days: [{ ...trip.days[0], events: [
    { id: 11, title: "Praia", start_time: "09:00", end_time: "10:00" },
    { id: 12, title: "Museu", start_time: "11:00", end_time: "13:00" },
  ] }] };
  const draft = [{ ...source.days[0], events: [{ ...source.days[0].events[1], title: "Alterado" }, source.days[0].events[0]] }];
  const events = scheduleItineraryDays(source, draft)[0].events;
  assert.deepEqual(events.map(event => [event.title, event.start_time, event.end_time]), [["Museu", "09:00", "11:00"], ["Praia", "11:30", "12:30"]]);
  assert.equal(source.days[0].events[0].start_time, "09:00");
  const removed = scheduleItineraryDays(source, [{ ...source.days[0], events: [source.days[0].events[1]] }]);
  assert.equal(removed[0].events[0].start_time, "09:00");
});
test("converts actual amounts across currencies, preserving zero and missing rates", () => {
  const rates = [
    { quote: "EUR", rate: 1 },
    { quote: "BRL", rate: 6 },
    { quote: "JPY", rate: 180 },
  ];
  assert.equal(convertAmount(18000, "JPY", "BRL", rates), 600);
  assert.equal(convertAmount(0, "EUR", "BRL", rates), 0);
  assert.equal(convertAmount(100, "ARS", "BRL", rates), null);
  assert.equal(convertAmount(null, "BRL", "BRL", rates), null);
});
test("categories come from real POI tags and DNA changes the recommendation order", () => {
  const beach = {
    id: 1,
    name: "Praia",
    pois: [{ tags: [{ name: "Praia", slug: "praia" }] }],
  };
  const museum = {
    id: 2,
    name: "Museu",
    pois: [{ tags: [{ name: "Cultura", slug: "cultura" }] }],
  };
  assert.deepEqual(destinationCategories(beach), ["Praia"]);
  assert.equal(
    rankDestinations([museum, beach], {
      nature_interest: 10,
      cultural_interest: 1,
    })[0].id,
    1,
  );
  assert.equal(
    rankDestinations([museum, beach], {
      nature_interest: 1,
      cultural_interest: 10,
    })[0].id,
    2,
  );
});
// Programação como vem do backend-nest: ids bigint em string, horários HH:MM:SS e custos decimais.
const program = {
  id: "7",
  title: "Lisboa",
  duration_days: 2,
  budget_total: "75.50",
  metadata: { program_history: [{ title: "Lisboa" }] },
  days: [
    { id: "10", day_number: 1, title: "Centro", estimated_cost: "60.00", events: [
      { id: "1", title: "Museu", estimated_cost: "10.00", start_time: "09:00:00", end_time: "10:00:00" },
      { id: "2", title: "Mirante", estimated_cost: "20.00", start_time: "10:30:00", end_time: "12:30:00" },
      { id: "3", title: "Feira", estimated_cost: "30.00", start_time: "13:00:00", end_time: "14:00:00" },
    ] },
    { id: "20", day_number: 2, title: "Praia", estimated_cost: "15.50", events: [
      { id: "4", title: "Praia", estimated_cost: "15.50", start_time: "10:00:00", end_time: "11:30:00" },
    ] },
  ],
};
const ids = (days) => days.map(day => day.events.map(event => String(event.id)));
test("program layout sends every day with numeric event ids in screen order", () => {
  assert.deepEqual(programLayout(program.days), { days: [{ day_number: 1, event_ids: [1, 2, 3] }, { day_number: 2, event_ids: [4] }] });
});
test("reorder, move and remove return new days without mutating the server state", () => {
  assert.deepEqual(ids(reorderEvent(program.days, 1, 2, 0)), [["3", "1", "2"], ["4"]]);
  assert.deepEqual(ids(reorderEvent(program.days, 1, 0, 9)), [["1", "2", "3"], ["4"]], "out of range keeps the day");
  assert.deepEqual(ids(moveEvent(program.days, "2", 2)), [["1", "3"], ["4", "2"]]);
  assert.equal(moveEvent(program.days, 2, 1), program.days, "same day keeps the program");
  assert.equal(moveEvent(program.days, 2, 9), program.days, "unknown day keeps the program");
  assert.deepEqual(ids(removeEvent(program.days, 1)), [["2", "3"], ["4"]]);
  assert.deepEqual(ids(program.days), [["1", "2", "3"], ["4"]]);
});
test("optimistic program recalculates times, day costs and total like the server", () => {
  const moved = applyProgram(program, moveEvent(program.days, "2", 2));
  assert.deepEqual(moved.days.map(day => day.events.map(event => [event.title, event.start_time, event.end_time])), [
    [["Museu", "09:00", "10:00"], ["Feira", "10:30", "11:30"]],
    [["Praia", "10:00", "11:30"], ["Mirante", "12:00", "14:00"]],
  ]);
  assert.deepEqual(moved.days.map(day => day.estimated_cost), [40, 35.5]);
  assert.equal(moved.budget_total, "75.50");
  const removed = applyProgram(program, removeEvent(program.days, "3"));
  assert.equal(removed.budget_total, "45.50");
  assert.equal(program.budget_total, "75.50");
});
test("an activity that would end after midnight is refused before anything is sent", () => {
  const late = { ...program, days: [program.days[0], { ...program.days[1], events: [{ id: "4", title: "Show", estimated_cost: "1", start_time: "22:00:00", end_time: "23:30:00" }] }] };
  assert.throws(() => applyProgram(late, moveEvent(late.days, "2", 2)), /dia 2 passariam da meia-noite/);
});
test("undo is available while the server keeps a history", () => {
  assert.equal(programHistorySize(program), 1);
  assert.equal(programHistorySize({ ...program, metadata: {} }), 0);
  assert.equal(programHistorySize(null), 0);
});
test("return date follows the start date and the trip duration", () => {
  assert.equal(tripEndDate("2026-11-10", 4), "2026-11-13");
  assert.equal(tripEndDate("2028-02-28", "3"), "2028-03-01");
  assert.equal(tripEndDate("2026-11-10", 1), "2026-11-10");
  assert.equal(tripEndDate("2026-02-30", 2), null);
  assert.equal(tripEndDate("", 2), null);
  assert.equal(tripEndDate("2026-11-10", 0), null);
});
test("legacy browser programs are deleted, other keys stay", () => {
  localStorage.setItem("viajero.1.itinerary.7.program", "{}");
  localStorage.setItem("viajero.guest.itinerary.8.program", "{}");
  localStorage.setItem("viajero.1.favorites.itineraries", "[]");
  localStorage.setItem("viajero.access_token", "token");
  assert.equal(clearLegacyPrograms(localStorage), 2);
  assert.deepEqual([...storage.keys()].sort(), ["viajero.1.favorites.itineraries", "viajero.access_token"]);
  assert.equal(clearLegacyPrograms({ get length() { throw new Error("blocked"); } }), 0);
});
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
test("save queue sends one action at a time, in order, and only the newest response replaces the screen", async () => {
  const settled = [];
  let started = 0;
  const queue = createSaveQueue({ onStart: () => { started += 1; }, onSettled: (outcome, latest) => settled.push([outcome.ok ? outcome.value : "erro", latest]) });
  const first = deferred(), second = deferred();
  const calls = [];
  void queue.push(() => { calls.push("primeira"); return first.promise; });
  void queue.push(() => { calls.push("segunda"); return second.promise; });
  await Promise.resolve();
  assert.deepEqual(calls, ["primeira"], "the second PUT waits for the first");
  assert.equal(queue.size(), 2);
  first.resolve("v1");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ["primeira", "segunda"]);
  second.resolve("v2");
  await queue.drain();
  assert.deepEqual(settled, [["v1", false], ["v2", true]]);
  assert.equal(started, 2);
  assert.equal(queue.size(), 0);
});
test("a failed action does not block the next one and can be retried", async () => {
  const settled = [];
  const queue = createSaveQueue({ onSettled: (outcome, latest) => settled.push([outcome, latest]) });
  let attempts = 0;
  const flaky = async () => { attempts += 1; if (attempts === 1) throw new Error("offline"); return "salvo"; };
  void queue.push(flaky);
  void queue.push(async () => "depois");
  await queue.drain();
  assert.equal(settled[0][0].ok, false);
  assert.equal(settled[0][1], false);
  assert.deepEqual(settled[1], [{ ok: true, value: "depois" }, true]);
  await queue.push(settled[0][0].task);
  assert.deepEqual(settled[2], [{ ok: true, value: "salvo" }, true]);
});
test("a throwing handler does not stop the queue", async () => {
  let calls = 0;
  const queue = createSaveQueue({ onSettled: () => { calls += 1; if (calls === 1) throw new Error("handler"); } });
  await queue.push(async () => 1).catch(() => undefined);
  await queue.push(async () => 2);
  assert.equal(calls, 2);
});
test("trip review becomes available after the full return day, never before", () => {
  assert.equal(
    tripHasEnded("2026-10-09", new Date("2026-10-09T12:00:00")),
    false,
  );
  assert.equal(
    tripHasEnded("2026-10-09", new Date("2026-10-10T00:00:00")),
    true,
  );
  assert.equal(tripHasEnded(null), false);
  assert.equal(tripHasEnded("invalid"), false);
});


test("planning draft preserves dinner step and optional availability", () => {
  const snapshot = { currentIndex: 7, fieldValues: { arrival_time: "16:00", departure_time: "10:00" }, cardSelections: { dinner: [2] }, tagValues: {} };
  assert.equal(savePlanningDraft(987, { snapshot }), true);
  assert.deepEqual(readPlanningDraft(987)?.snapshot, snapshot);
  clearPlanningDraft(987);
});


test("legacy draft indexes follow the original step keys", () => {
  for (let index = 0; index < 8; index++) {
    const value = { snapshot: { currentIndex: index, fieldValues: {}, cardSelections: { dinner: [2] }, tagValues: {} } };
    localStorage.setItem(planningDraftKey(1), JSON.stringify({ version: 1, updatedAt: Date.now(), value }));
    assert.equal(readPlanningDraft(1)?.snapshot.currentIndex, [0, 1, 2, 3, 5, 6, 7, 4][index]);
  }
});

test("arrival and departure are separate markers on a single day", () => {
 const trip = { days: [{ day_number: 1 }], start_date: "2026-11-12", end_date: "2026-11-12", metadata: { trip_preferences: { metadata: { arrival_time: "09:00", departure_time: "18:00" } } } };
 assert.deepEqual(tripMilestones(trip, 1).map(mark => mark.time), ["09:00", "18:00"]);
 assert.equal(tripMilestones(trip, 2).length, 0);
 assert.equal(tripMilestones({ days: [{ day_number: 1 }] }, 1)[0].time, undefined);
});
test("day labels keep UTF-8 separators and accents", () => {
 const source = readFileSync(new URL("../src/pages/roteiros/roteiro-detalhe.tsx", import.meta.url), "utf8");
 assert.ok(source.includes("Dia {day.day_number} \u00b7"));
 assert.ok(!source.includes("Programa??o"));
});
