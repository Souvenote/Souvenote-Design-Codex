"use client";

import * as React from "react";

type HomepageScrollWindow = Pick<
  Window,
  "cancelAnimationFrame" | "requestAnimationFrame" | "scrollTo"
> & {
  history: Pick<History, "scrollRestoration">;
  location: Pick<Location, "hash">;
};

type HomepageScrollRoot = {
  style: Pick<CSSStyleDeclaration, "scrollBehavior">;
};

export function scheduleHomepageScrollReset(
  targetWindow: HomepageScrollWindow,
  root: HomepageScrollRoot,
) {
  if (targetWindow.location.hash) return;

  const previousScrollBehavior = root.style.scrollBehavior;
  const previousScrollRestoration = targetWindow.history.scrollRestoration;
  root.style.scrollBehavior = "auto";
  targetWindow.history.scrollRestoration = "manual";
  targetWindow.scrollTo({ top: 0, left: 0 });

  let finalFrame = 0;
  const initialFrame = targetWindow.requestAnimationFrame(() => {
    targetWindow.scrollTo({ top: 0, left: 0 });
    finalFrame = targetWindow.requestAnimationFrame(() => {
      targetWindow.scrollTo({ top: 0, left: 0 });
      root.style.scrollBehavior = previousScrollBehavior;
    });
  });

  return () => {
    targetWindow.cancelAnimationFrame(initialFrame);
    if (finalFrame) targetWindow.cancelAnimationFrame(finalFrame);
    root.style.scrollBehavior = previousScrollBehavior;
    targetWindow.history.scrollRestoration = previousScrollRestoration;
  };
}

export function HomepageScrollReset() {
  React.useLayoutEffect(
    () => scheduleHomepageScrollReset(window, document.documentElement),
    [],
  );

  return null;
}
