import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export default function LibraryPage() {
  return (
    <PlaceholderPage
      eyebrow="My Cards & Songs"
      title="Your library,"
      highlight="saved & ready."
      description="Resume drafts, re-send saved cards, and queue more songs. Your personal library view is being designed now."
      cta={{ label: "Start a new card", href: "/options" }}
    />
  );
}
