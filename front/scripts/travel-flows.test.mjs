import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { localizedDestination, matchesDestinationQuery } from "../src/lib/destination-language.ts";
import { scheduleItineraryDays } from "../src/features/itineraries/itinerary-schedule.ts";
import { tripDuration, parseTripDate, selectTripRange } from "../src/lib/trip-dates.ts";
import { readPlanningDraft, savePlanningDraft, clearPlanningDraft, planningDraftKey } from "../src/lib/planning-draft.ts";
import { filterDestinations } from "../src/lib/destination-filters.ts";
import { destinationRecommendationReason } from "../src/lib/personalization.ts";
import { dayInsights, draftChanges } from "../src/features/itineraries/itinerary-insights.ts";
import { convertAmount } from "../src/lib/currency.ts";
import {
  destinationCategories,
  rankDestinations,
} from "../src/lib/personalization.ts";
import {
  localProgramKey,
  readLocalProgram,
  saveLocalProgram,
  tripHasEnded,
} from "../src/features/itineraries/itinerary-editing.ts";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
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
test("draft change summary tracks removals and reordering, and undo restores the baseline", () => {
  const reordered = { ...trip, days: [{ ...trip.days[0], events: [...trip.days[0].events].reverse() }] };
  assert.equal(draftChanges(trip, reordered).reorderedDays, 1);
  const removed = { ...trip, days: [{ ...trip.days[0], events: [trip.days[0].events[1]] }] };
  assert.equal(draftChanges(trip, removed).removed, 1);
  assert.equal(draftChanges(trip, structuredClone(trip)).changed, false);
  assert.equal(trip.days[0].events.length, 2);
});
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
test("removal and reordering survive reload without mutating the original itinerary", () => {
  const key = localProgramKey(1, trip.id);
  const days = [{ ...trip.days[0], events: [trip.days[0].events[1]] }];
  saveLocalProgram(trip, days, key);
  const restored = readLocalProgram(trip, key);
  assert.deepEqual(
    restored.days[0].events.map((event) => event.id),
    [12],
  );
  assert.equal(restored.days[0].events[0].order_index, 0);
  assert.equal(trip.days[0].events.length, 2);
  assert.equal(
    readLocalProgram(trip, localProgramKey(2, trip.id)).days[0].events.length,
    2,
  );
});
test("regeneration and corrupt storage do not restore an obsolete program", () => {
  const key = localProgramKey(1, trip.id);
  saveLocalProgram(trip, [], key);
  const regenerated = {
    ...trip,
    days: [{ ...trip.days[0], events: [{ id: 99, title: "Nova atividade" }] }],
  };
  assert.equal(readLocalProgram(regenerated, key).days[0].events[0].id, 99);
  localStorage.setItem(key, "broken JSON");
  assert.equal(readLocalProgram(trip, key), trip);
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
