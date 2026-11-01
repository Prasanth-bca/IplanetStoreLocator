import React from 'react';

/**
 * The app's logo: a chrome interlocking-loop mark (public/images/brand-logo.png) on a charcoal square.
 * The image already includes its dark background, so it is shown as a full tile: give it the tile's size.
 */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/brand-logo.png" width={size} height={size} alt="iPlanet CEC Connect logo" className={`block shrink-0 object-cover ${className}`} draggable={false} />;
}
