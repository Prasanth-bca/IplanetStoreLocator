import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { UserHeartbeat } from '@/components/UserHeartbeat';
import { PALETTE_BOOT_SCRIPT } from '@/lib/palettes';

export const metadata: Metadata = {
  title: 'iPlanet AI Store Locator | Find Nearest iPlanet Retail Store',
  description:
    'Instantly find the nearest official iPlanet Apple Authorised Reseller stores by PIN code, area, city, landmark, or your current location. Showing distance, travel time & live directions.',
  keywords: 'iPlanet, Apple Authorised Reseller, store locator, Apple store near me, iPhone, MacBook, iPad, retailer',
  openGraph: {
    title: 'iPlanet AI Store Locator',
    description: 'Find official iPlanet stores instantly — by PIN, area, city, landmark, or GPS.',
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
        </ThemeProvider>
      </body>
    </html>
  );
}
