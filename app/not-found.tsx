import Link from 'next/link';
import { Compass } from 'lucide-react';

/** Shown for any address the app doesn't have, with a way back instead of a bare 404. */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F1FD] dark:bg-[#0d0b26] px-4">
      <div className="w-full max-w-sm text-center bg-white dark:bg-[#1A1740] rounded-3xl p-8 border border-gray-200/80 dark:border-white/10 shadow-sm">
        <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
          <Compass className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-xl font-extrabold text-gray-950 dark:text-white">Page not found</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">That address doesn’t exist in this app.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
          style={{ textDecoration: 'none' }}
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
