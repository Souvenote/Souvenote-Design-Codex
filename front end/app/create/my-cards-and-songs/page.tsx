import { CreateFlowPlaceholder } from "../../components/CreateFlowPlaceholder";

export default function MyCardsAndSongsPage() {
  return (
    <CreateFlowPlaceholder
      title="My Cards & Songs"
      description="This future page will help returning users resume drafts, revisit saved cards, and manage generated songs."
      actions={[
        {
          label: "Generate Another Song",
          description: "Requires AI credits because this creates new audio.",
          requirement: "generation",
          readyMessage: "Song generation is clear to continue once the music flow is connected.",
        },
        {
          label: "Send Saved Card",
          description: "Requires a card in the user's card bank before delivery.",
          requirement: "send",
          readyMessage: "Saved-card sending is clear to continue once delivery is connected.",
        },
      ]}
    />
  );
}
