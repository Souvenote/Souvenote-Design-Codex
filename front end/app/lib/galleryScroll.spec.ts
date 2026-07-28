import { describe, expect, it, vi } from "vitest";

import { scrollContainerToItem } from "./galleryScroll";

function rectAt(left: number) {
  return { left } as DOMRect;
}

describe("gallery horizontal scrolling", () => {
  it("keeps the initial card at the start without requesting document scrolling", () => {
    const scrollTo = vi.fn();
    const scrollIntoView = vi.fn();
    const container = {
      scrollLeft: 0,
      scrollTo,
      getBoundingClientRect: () => rectAt(96),
    } as unknown as HTMLElement;
    const item = {
      scrollIntoView,
      getBoundingClientRect: () => rectAt(96),
    } as unknown as Element;

    scrollContainerToItem(container, item, "auto");

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: "auto" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("moves only the carousel by the selected card's horizontal offset", () => {
    const scrollTo = vi.fn();
    const container = {
      scrollLeft: 240,
      scrollTo,
      getBoundingClientRect: () => rectAt(100),
    } as unknown as HTMLElement;
    const item = {
      getBoundingClientRect: () => rectAt(380),
    } as unknown as Element;

    scrollContainerToItem(container, item, "smooth");

    expect(scrollTo).toHaveBeenCalledWith({ left: 520, behavior: "smooth" });
  });
});
