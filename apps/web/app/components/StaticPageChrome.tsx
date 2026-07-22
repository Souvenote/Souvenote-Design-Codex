import type { ReactNode } from 'react';
import { DemoNavbar } from './DemoNavbar';
import { Footer } from './Footer';
import { PageChrome } from './PageChrome';

type StaticPageChromeProps = {
  children: ReactNode;
  pageClass?: string;
};

export function StaticPageChrome({ children, pageClass = 'pg-page' }: StaticPageChromeProps) {
  return (
    <div className="souv-route-page">
      <PageChrome variant="pages" />
      <div className={pageClass}>
        <DemoNavbar cartCount={0} />
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
