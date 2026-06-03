import { PlaceholderPage } from "@/components/ui/PlaceholderPage";

export default function CreatePage() {
  return (
    <PlaceholderPage
      eyebrow="Build My Card"
      title="Build a card"
      highlight="from scratch."
      description="Answer a few questions about your moment and watch Souvenote craft the image, words, and song. The full builder flow is on its way."
      cta={{ label: "Personalize a template instead", href: "/personalize" }}
    />
  );
}
