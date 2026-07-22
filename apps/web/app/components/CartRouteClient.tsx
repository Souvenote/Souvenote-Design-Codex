'use client';

import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { PageChrome } from './PageChrome';
import { CartPage } from './CartPage';
import { useAuth } from './AuthProvider';

export function CartRouteClient() {
  const auth = useAuth();
  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar
          loggedIn={auth.status === 'authenticated'}
          user={auth.displayUser ?? undefined}
          credits={{ images: 0, songs: 0 }}
          cardBank={0}
          cartCount={0}
        />
        <main>
          <CartPage />
        </main>
        <Footer />
      </div>
    </div>
  );
}
