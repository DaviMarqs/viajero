import { ItineraryComposite, ItineraryDayComposite, ItineraryEventLeaf } from '../itinerary-composite';

describe('ItineraryComposite', () => {
  it('treats itinerary, days and events through the same component interface', () => {
    const day = new ItineraryDayComposite({ title: 'Day 1' })
      .add(new ItineraryEventLeaf({ title: 'Museum', estimated_cost: '25.50' }))
      .add(new ItineraryEventLeaf({ title: 'Dinner', estimated_cost: 40 }));

    const itinerary = new ItineraryComposite('Lisbon').add(day);

    expect(itinerary.getEstimatedCost()).toBe(65.5);
    expect(itinerary.toPlainObject()).toMatchObject({
      title: 'Lisbon',
      estimated_cost: '65.50',
    });
  });
});
