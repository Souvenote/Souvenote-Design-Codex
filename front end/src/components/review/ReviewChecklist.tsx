interface ReviewChecklistProps {
  items: string[];
}

/** The "everything generated together" checklist on the review screen. */
export function ReviewChecklist({ items }: ReviewChecklistProps) {
  return (
    <ul className="souv-review-list">
      {items.map((item) => (
        <li key={item}>
          <svg
            className="souv-review-tick"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {item}
        </li>
      ))}
    </ul>
  );
}
