type HorizontalScrollContainer = Pick<
  HTMLElement,
  "getBoundingClientRect" | "scrollLeft" | "scrollTo"
>;

type HorizontalScrollItem = Pick<Element, "getBoundingClientRect">;

export function scrollContainerToItem(
  container: HorizontalScrollContainer,
  item: HorizontalScrollItem,
  behavior: ScrollBehavior,
) {
  const containerLeft = container.getBoundingClientRect().left;
  const itemLeft = item.getBoundingClientRect().left;

  container.scrollTo({
    left: container.scrollLeft + itemLeft - containerLeft,
    behavior,
  });
}
