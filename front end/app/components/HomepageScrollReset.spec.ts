import { describe, expect, it, vi } from "vitest";

import { scheduleHomepageScrollReset } from "./HomepageScrollReset";

describe("homepage initial scroll reset", () => {
  it("keeps a non-anchor homepage load at the hero", () => {
    const scrollTo = vi.fn();
    const cancelAnimationFrame = vi.fn();
    const frames: FrameRequestCallback[] = [];
    let nextFrameId = 17;
    const targetWindow = {
      history: { scrollRestoration: "auto" },
      location: { hash: "" },
      scrollTo,
      cancelAnimationFrame,
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        nextFrameId += 1;
        return nextFrameId;
      }),
    } as unknown as Window;
    const root = { style: { scrollBehavior: "smooth" } };

    const cleanup = scheduleHomepageScrollReset(targetWindow, root);

    expect(root.style.scrollBehavior).toBe("auto");
    expect(targetWindow.history.scrollRestoration).toBe("manual");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0 });

    frames.shift()?.(0);

    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(root.style.scrollBehavior).toBe("auto");

    frames.shift()?.(0);

    expect(scrollTo).toHaveBeenCalledTimes(3);
    expect(root.style.scrollBehavior).toBe("smooth");

    cleanup?.();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(18);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(19);
    expect(targetWindow.history.scrollRestoration).toBe("auto");
  });

  it("preserves an explicit homepage anchor", () => {
    const scrollTo = vi.fn();
    const targetWindow = {
      history: { scrollRestoration: "auto" },
      location: { hash: "#gallery" },
      scrollTo,
      cancelAnimationFrame: vi.fn(),
      requestAnimationFrame: vi.fn(),
    } as unknown as Window;
    const root = { style: { scrollBehavior: "smooth" } };

    expect(scheduleHomepageScrollReset(targetWindow, root)).toBeUndefined();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(root.style.scrollBehavior).toBe("smooth");
  });
});
