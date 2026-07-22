import { AuthApp } from "../components/Auth";
import { PageChrome } from "../components/PageChrome";
import { Suspense } from "react";

export default function AuthPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="auth" />
      <main><Suspense fallback={null}><AuthApp initialState="signup" /></Suspense></main>
    </div>
  );
}
