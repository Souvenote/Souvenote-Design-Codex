"use client";

import { Navbar } from "./Navbar";
import { demoUser } from "./DemoUser";
import { useAuth } from "./AuthProvider";
import type { NavbarProps } from "./Navbar";

type DemoNavbarProps = Pick<NavbarProps, "followUserOnScroll"> & {
  cartCount?: number;
  onLoginClick?: () => void;
  onSignupClick?: () => void;
  variant?: string;
};

function DemoNavbar({ cartCount = 0, ...props }: DemoNavbarProps) {
  const auth = useAuth();

  return (
    <Navbar
      loggedIn={auth.status === "authenticated"}
      user={demoUser}
      credits={{ images: 0, songs: 0 }}
      cardBank={0}
      cartCount={cartCount}
      {...props}
    />
  );
}

export { DemoNavbar };
