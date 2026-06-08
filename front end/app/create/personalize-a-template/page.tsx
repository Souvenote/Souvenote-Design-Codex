import { CreateFlowPlaceholder } from "../../components/CreateFlowPlaceholder";

export default function PersonalizeATemplatePage() {
  return (
    <CreateFlowPlaceholder
      title="Personalize a Template"
      description="This future flow will let users choose a Souvenote template and personalize it before generating the final card and song."
      actions={[
        {
          label: "Generate Template Preview",
          description: "Requires AI credits before any image or song generation starts.",
          requirement: "generation",
          readyMessage: "Generation is clear to continue once the template builder is connected.",
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
