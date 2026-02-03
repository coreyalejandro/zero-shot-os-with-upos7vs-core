import type { Metadata } from "next";
import Link from "next/link";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "UPOS-7-VS Analytics Dashboard",
  description: "Comprehensive analytics and performance monitoring for UPOS-7-VS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorBoundary>
          <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-8">
                  <Link
                    href="/"
                    className="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
                  >
                    UPOS-7-VS
                  </Link>
                  <div className="flex space-x-1">
                    <Link
                      href="/"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Enhancements
                    </Link>
                    <Link
                      href="/analytics"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Analytics
                    </Link>
                    <Link
                      href="/router-metrics"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Router Metrics
                    </Link>
                    <Link
                      href="/component-inventory"
                      className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Component Inventory
                    </Link>
                    <Link
                      href="/enterprise"
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors"
                    >
                      Enterprise
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </nav>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
