import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { UserHeartbeat } from '@/components/UserHeartbeat';

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#F3F1FD] text-[#1F1B45] dark:bg-[#0d0b26] dark:text-[#F3F1FD] transition-colors duration-200">
        <ThemeProvider>
          <UserHeartbeat />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
