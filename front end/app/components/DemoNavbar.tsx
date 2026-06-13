"use client";

import { Navbar } from "./Navbar";
import { demoUser } from "./DemoUser";
import { useDemoBalance } from "./DemoBalance";

type DemoNavbarProps = {
  cartCount?: number;
  onLoginClick?: () => void;
  onSignupClick?: () => void;
  variant?: string;
};

function DemoNavbar({ cartCount = 0, ...props }: DemoNavbarProps) {
  const demoBalance = useDemoBalance();

  return (
    <Navbar
      loggedIn
      user={demoUser}
      credits={demoBalance.credits}
      cardBank={demoBalance.cardBank}
      cartCount={cartCount}
      {...props}
    />
  );
}

export { DemoNavbar };
