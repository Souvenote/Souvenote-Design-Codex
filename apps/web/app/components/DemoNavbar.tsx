'use client';

import { Navbar } from './Navbar';
import { useAuth } from './AuthProvider';
import type { NavbarProps } from './Navbar';

type DemoNavbarProps = Pick<NavbarProps, 'followUserOnScroll'> & {
  cartCount?: number;
  onLoginClick?: () => void;
  onSignupClick?: () => void;
  variant?: string;
};

function DemoNavbar({ cartCount = 0, ...props }: DemoNavbarProps) {
  const auth = useAuth();

  return (
    <Navbar
      loggedIn={auth.status === 'authenticated'}
      user={auth.displayUser ?? undefined}
      credits={{ images: 0, songs: 0 }}
      cardBank={0}
      cartCount={cartCount}
      {...props}
    />
  );
}

export { DemoNavbar };
