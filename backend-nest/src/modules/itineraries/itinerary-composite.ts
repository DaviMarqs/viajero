export interface ItineraryComponent {
  getTitle(): string;
  getEstimatedCost(): number;
  toPlainObject(): Record<string, unknown>;
}

export class ItineraryEventLeaf implements ItineraryComponent {
  constructor(private readonly event: { title: string; description?: string; estimated_cost?: string | number; order_index?: number }) {}

  getTitle(): string {
    return this.event.title;
  }

  getEstimatedCost(): number {
    return Number(this.event.estimated_cost ?? 0);
  }

  toPlainObject(): Record<string, unknown> {
    return this.event;
  }
}

export class ItineraryDayComposite implements ItineraryComponent {
  private readonly children: ItineraryComponent[] = [];

  constructor(private readonly day: { title: string; summary?: string; estimated_cost?: string | number; day_number?: number }) {}

  add(component: ItineraryComponent): this {
    this.children.push(component);
    return this;
  }

  getTitle(): string {
    return this.day.title;
  }

  getEstimatedCost(): number {
    return this.children.reduce((total, child) => total + child.getEstimatedCost(), 0);
  }

  toPlainObject(): Record<string, unknown> {
    return {
      ...this.day,
      estimated_cost: this.getEstimatedCost().toFixed(2),
      events: this.children.map((child) => child.toPlainObject()),
    };
  }
}

export class ItineraryComposite implements ItineraryComponent {
  private readonly days: ItineraryDayComposite[] = [];

  constructor(private readonly title: string) {}

  add(day: ItineraryDayComposite): this {
    this.days.push(day);
    return this;
  }

  getTitle(): string {
    return this.title;
  }

  getEstimatedCost(): number {
    return this.days.reduce((total, day) => total + day.getEstimatedCost(), 0);
  }

  toPlainObject(): Record<string, unknown> {
    return {
      title: this.title,
      estimated_cost: this.getEstimatedCost().toFixed(2),
      days: this.days.map((day) => day.toPlainObject()),
    };
  }
}
