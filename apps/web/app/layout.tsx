import type { Metadata } from 'next';
import './styles/colors_and_type.css';
import './styles/site.css';
import './styles/auth.css';
import './styles/options.css';
import './styles/bmc.css';
import './styles/cardart.css';
import './styles/pt.css';
import './styles/mycards.css';
import './styles/cart.css';
import './styles/delivery.css';
import './styles/account.css';
import './styles/pages.css';
import './styles/landing-chrome.css';
import './styles/next-app.css';
import { AuthProvider } from './components/AuthProvider';

export const metadata: Metadata = {
  title: 'Souvenote',
  description: 'A production-ready Next.js conversion of the Souvenote Claude Designs handoff.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
