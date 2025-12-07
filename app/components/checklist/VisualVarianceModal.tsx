"use client";

import { useState, useRef, useCallback } from "react";

// =============================================================================
// Types
// =============================================================================

interface VisualVarianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDimensionDetected: (dimension: number, unit: string) => void;
  parameterName: string;
  expectedValue?: string;
  unit?: string;
}

type AnalysisState = "idle" | "uploading" | "analyzing" | "complete" | "error";

interface AnalysisResult {
  estimatedDimension: number;
  unit: string;
  confidence: number;
  referenceUsed: string;
  notes?: string;
}

// =============================================================================
// Component
// =============================================================================

export function VisualVarianceModal({
  isOpen,
  onClose,
  onDimensionDetected,
  parameterName,
  expectedValue,
  unit = "in",
}: VisualVarianceModalProps) {
  const [state, setState] = useState<AnalysisState>("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
      setState("idle");
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleReferenceUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imagePreview) {
      setError("Please upload an image first");
      return;
    }

    setState("analyzing");
    setError(null);

    try {
      // Simulate AI vision analysis
      // In production, this would call an API endpoint that uses GPT-4 Vision
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock result - in production this would come from the vision API
      const mockResult: AnalysisResult = {
        estimatedDimension: 6.75 + Math.random() * 0.5,
        unit: unit,
        confidence: 0.85 + Math.random() * 0.1,
        referenceUsed: referenceImage ? "User-provided reference" : "Standard tape measure detection",
        notes: "Measurement taken from visible edge to edge",
      };

      setResult(mockResult);
      setState("complete");
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
      setState("error");
    }
  }, [imagePreview, referenceImage, unit]);

  const handleApplyMeasurement = useCallback(() => {
    if (result) {
      onDimensionDetected(parseFloat(result.estimatedDimension.toFixed(2)), result.unit);
      onClose();
    }
  }, [result, onDimensionDetected, onClose]);

  const handleClose = useCallback(() => {
    setImagePreview(null);
    setReferenceImage(null);
    setResult(null);
    setError(null);
    setState("idle");
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20 text-accent">
              <CameraIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Visual Dimension Analysis</h2>
              <p className="text-sm text-foreground-muted">
                Measuring: <span className="font-medium text-foreground">{parameterName}</span>
                {expectedValue && (
                  <span className="ml-2 text-primary">Expected: {expectedValue}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Main Photo Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Site Photo <span className="text-danger">*</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative aspect-video rounded-lg border-2 border-dashed cursor-pointer transition-all overflow-hidden
                  ${imagePreview
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-surface-hover"
                  }
                `}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Site photo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <UploadIcon className="w-8 h-8 text-foreground-muted mb-2" />
                    <p className="text-sm text-foreground-muted">Click to upload site photo</p>
                    <p className="text-xs text-foreground-muted mt-1">JPG, PNG up to 10MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Reference/Ghost Overlay Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Reference Drawing (Optional)
              </label>
              <div
                onClick={() => referenceInputRef.current?.click()}
                className={`
                  relative aspect-video rounded-lg border-2 border-dashed cursor-pointer transition-all overflow-hidden
                  ${referenceImage
                    ? "border-info bg-info/5"
                    : "border-border hover:border-info/50 hover:bg-surface-hover"
                  }
                `}
              >
                {referenceImage ? (
                  <img
                    src={referenceImage}
                    alt="Reference"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <LayersIcon className="w-8 h-8 text-foreground-muted mb-2" />
                    <p className="text-sm text-foreground-muted">Upload reference for overlay</p>
                    <p className="text-xs text-foreground-muted mt-1">CAD drawing or spec sheet</p>
                  </div>
                )}
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Ghost Overlay Preview */}
          {imagePreview && referenceImage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">
                  Overlay Comparison
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground-muted">Opacity:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    className="w-24 h-1 bg-surface-hover rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-foreground-muted w-8">{Math.round(overlayOpacity * 100)}%</span>
                </div>
              </div>
              <div className="relative aspect-video rounded-lg border border-border overflow-hidden bg-black">
                <img
                  src={imagePreview}
                  alt="Site photo"
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <img
                  src={referenceImage}
                  alt="Reference overlay"
                  className="absolute inset-0 w-full h-full object-contain mix-blend-difference"
                  style={{ opacity: overlayOpacity }}
                />
              </div>
              <p className="text-xs text-foreground-muted text-center">
                Adjust opacity to compare site photo with reference drawing
              </p>
            </div>
          )}

          {/* Analysis State */}
          {state === "analyzing" && (
            <div className="py-8 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <EyeIcon className="w-6 h-6 text-accent animate-pulse" />
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Analyzing Image...</h3>
              <p className="mt-2 text-sm text-foreground-muted text-center max-w-sm">
                AI is detecting dimensions and reference points in your photo
              </p>
            </div>
          )}

          {/* Results */}
          {state === "complete" && result && (
            <div className="p-4 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-success/20 text-success">
                  <RulerIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-success">Measurement Detected</h4>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-foreground-muted uppercase tracking-wide">Estimated Value</p>
                      <p className="text-2xl font-bold text-foreground font-mono">
                        {result.estimatedDimension.toFixed(2)} <span className="text-sm">{result.unit}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-muted uppercase tracking-wide">Confidence</p>
                      <p className="text-2xl font-bold text-foreground">
                        {Math.round(result.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-success/20">
                    <p className="text-xs text-foreground-muted">
                      <span className="font-medium">Reference:</span> {result.referenceUsed}
                    </p>
                    {result.notes && (
                      <p className="text-xs text-foreground-muted mt-1">
                        <span className="font-medium">Notes:</span> {result.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-lg bg-danger/10 border border-danger/30">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 p-4 border-t border-border bg-surface">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>

          {state === "complete" && result ? (
            <button
              onClick={handleApplyMeasurement}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-success hover:bg-success/90 text-white transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              Apply {result.estimatedDimension.toFixed(2)} {result.unit}
            </button>
          ) : (
            <button
              onClick={handleAnalyze}
              disabled={!imagePreview || state === "analyzing"}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state === "analyzing" ? (
                <>
                  <LoadingSpinner className="w-4 h-4" />
                  Analyzing...
                </>
              ) : (
                <>
                  <EyeIcon className="w-4 h-4" />
                  Analyze Photo
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function CameraIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function XIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function UploadIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function LayersIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  );
}

function EyeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function RulerIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function LoadingSpinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default VisualVarianceModal;
