import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { UserHeartbeat } from '@/components/UserHeartbeat';
import { ChatWidget } from '@/components/ChatWidget';
import { LeadAlerts } from '@/components/storeLeads/LeadAlerts';
import { PALETTE_BOOT_SCRIPT } from '@/lib/palettes';

export const metadata: Metadata = {
  title: 'iPlanet CEC Connect | One click, everything connected',
  description:
    'iPlanet CEC Connect: one click, everything connected. Stores, stock and offers for the iPlanet Customer Experience Centre team.',
  keywords: 'iPlanet, CEC Connect, Customer Experience Centre, Apple Authorised Reseller, store locator, Apple store near me, iPhone, MacBook, iPad, retailer',
  openGraph: {
    title: 'iPlanet CEC Connect',
    description: 'One click, everything connected. Stores, stock and offers for the iPlanet Customer Experience Centre team.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-pal-page text-pal-ink dark:bg-pal-page-dark dark:text-pal-page transition-colors duration-200">
        <ThemeProvider>
          <UserHeartbeat />
          {children}
          <ChatWidget />
          <LeadAlerts />
        </ThemeProvider>
      </body>
    </html>
  );
}
