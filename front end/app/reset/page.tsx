import { Suspense } from "react";
import { AuthApp } from "../components/Auth";
import { PageChrome } from "../components/PageChrome";

export default function AuthPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="auth" />
      <main><Suspense fallback={null}><AuthApp initialState="reset" /></Suspense></main>
    </div>
  );
}
