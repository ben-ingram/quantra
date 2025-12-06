"use client";

import { useState } from "react";

interface ExportButtonProps {
  projectName: string;
}

export function ExportButton({ projectName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setShowToast(true);

    // Simulate export delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsExporting(false);

    // Hide toast after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  return (
    <>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-none hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
      >
        {isExporting ? (
          <>
            <LoadingSpinner />
            Generating...
          </>
        ) : (
          <>
            <DocumentIcon />
            Export Compliance Certificate (PDF)
          </>
        )}
      </button>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up print:hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-lg shadow-lg">
            {isExporting ? (
              <>
                <LoadingSpinner />
                <div>
                  <p className="text-sm font-medium">Generating Report...</p>
                  <p className="text-xs text-gray-400">
                    Compiling compliance data for {projectName}
                  </p>
                </div>
              </>
            ) : (
              <>
                <CheckCircleIcon />
                <div>
                  <p className="text-sm font-medium">Report Ready</p>
                  <p className="text-xs text-gray-400">
                    PDF generation complete. Download starting...
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
