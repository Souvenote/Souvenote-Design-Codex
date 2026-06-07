import { AuthApp } from "../../components/Auth";
import { PageChrome } from "../../components/PageChrome";

export default function AuthPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="auth" />
      <AuthApp initialState="verify-expired" />
    </div>
  );
}
