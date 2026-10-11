import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#fbfbfd] text-[#1d1d1f]">
        {children}
      </body>
    </html>
  );
}
