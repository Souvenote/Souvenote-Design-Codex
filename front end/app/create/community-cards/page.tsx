import { CreateFlowPlaceholder } from "../../components/CreateFlowPlaceholder";

export default function CommunityCardsPage() {
  return (
    <CreateFlowPlaceholder
      title="Community Cards"
      description="This future page will let users browse, send, or remix cards shared by the Souvenote community."
      actions={[
        {
          label: "Remix Community Card",
          description: "Requires AI credits because remixing triggers new generation.",
          requirement: "generation",
          readyMessage: "Community remix is clear to continue once remix tools are connected.",
        },
        {
          label: "Send Community Card",
          description: "Requires a card in the user's card bank when sending as-is.",
          requirement: "send",
          readyMessage: "Community sending is clear to continue once delivery is connected.",
        },
      ]}
    />
  );
}
