import { CreateFlowPlaceholder } from "../../components/CreateFlowPlaceholder";

export default function BuildMyCardPage() {
  return (
    <CreateFlowPlaceholder
      title="Build My Card"
      description="This future flow will guide users from their own card idea into a custom Souvenote design and song."
      actions={[
        {
          label: "Generate Custom Card",
          description: "Requires AI credits before design or song creation runs.",
          requirement: "generation",
          readyMessage: "Custom generation is clear to continue once the card builder is connected.",
        },
        {
          label: "Send Finished Card",
          description: "Requires at least one card in the user's card bank at delivery.",
          requirement: "send",
          readyMessage: "Delivery is clear to continue once the finished-card checkout is connected.",
        },
      ]}
    />
  );
}
