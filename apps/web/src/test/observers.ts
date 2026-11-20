/**
 * jsdom lays nothing out, so it has no IntersectionObserver or ResizeObserver. These stand in: nothing
 * intersects until a test calls `bringIntoView()`, and a resize observer measures once when it starts.
 */
const watching = new Set<TestIntersectionObserver>();

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds = [0];
  readonly elements = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(element: Element) {
    this.elements.add(element);
    watching.add(this);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
    watching.delete(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  intersect() {
    const entries = [...this.elements].map(
      (target) => ({ target, isIntersecting: true, intersectionRatio: 1 }) as IntersectionObserverEntry,
    );
    if (entries.length > 0) {
      this.callback(entries, this);
    }
  }
}

class TestResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe() {
    this.callback([], this);
  }

  unobserve() {
    // Sizes never change in jsdom: nothing to stop.
  }

  disconnect() {
    // As above.
  }
}

/** Everything observed scrolls into view: lazy rows load, a grid's end comes near. */
export function bringIntoView() {
  for (const observer of [...watching]) {
    observer.intersect();
  }
}

export function installObservers() {
  watching.clear();
  globalThis.IntersectionObserver = TestIntersectionObserver;
  globalThis.ResizeObserver = TestResizeObserver;
}
