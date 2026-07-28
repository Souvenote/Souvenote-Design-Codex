import { Suspense } from "react";

import { AuthApp } from "../components/Auth";
import { PageChrome } from "../components/PageChrome";

export default function FirstLoginPage() {
  return (
    <div className="souv-route-page">
      <PageChrome variant="auth" />
      <main>
        <Suspense fallback={null}>
          <AuthApp initialState="first-login" />
        </Suspense>
      </main>
    </div>
  );
}
