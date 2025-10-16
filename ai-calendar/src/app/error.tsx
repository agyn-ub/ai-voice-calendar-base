'use client';

export const dynamic = 'force-dynamic';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">500</h1>
        <h2 className="text-2xl mb-4">Something went wrong!</h2>
        <p className="text-gray-400 mb-8">An error occurred while processing your request.</p>
        <div className="space-x-4">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors"
          >
            Try again
          </button>
          <a 
            href="/" 
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors inline-block"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}