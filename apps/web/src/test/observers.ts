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

  intersect(isIntersecting = true) {
    const entries = [...this.elements].map(
      (target) =>
        ({ target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }) as IntersectionObserverEntry,
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

/** Everything observed scrolls out of view. */
export function leaveView() {
  for (const observer of [...watching]) {
    observer.intersect(false);
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

let reducedMotion = false;

/** What `prefers-reduced-motion: reduce` answers until the next test; motion is allowed by default. */
export function preferReducedMotion(value: boolean) {
  reducedMotion = value;
}

/** jsdom has no `matchMedia`: every query is false except reduced motion, which a test may ask for. */
export function installMatchMedia() {
  reducedMotion = false;
  // The application reads `matches` and listens for `change`; the deprecated listener methods are left out.
  window.matchMedia = (query: string) =>
    Object.assign(new EventTarget(), {
      matches: query.includes('prefers-reduced-motion: reduce') && reducedMotion,
      media: query,
      onchange: null,
    }) as unknown as MediaQueryList;
}
