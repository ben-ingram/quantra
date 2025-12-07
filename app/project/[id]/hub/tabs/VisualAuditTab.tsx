"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Camera,
  Scan,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Ruler,
  Eye,
  ClipboardCheck,
  X,
} from "lucide-react";
import type { ChecklistItemWithMetadata } from "@/app/actions/checklists";

// =============================================================================
// Types
// =============================================================================

type AuditStep = "upload" | "analyzing" | "result";

interface AuditResult {
  status: "pass" | "warning" | "fail";
  description: string;
  confidence: number;
  deviationPercentage?: number;
}

interface VerificationContext {
  item: ChecklistItemWithMetadata;
  requirement: string;
  codeReference: string | null;
}

interface VisualAuditTabProps {
  projectId: string;
  verificationContext?: VerificationContext | null;
  onVerificationComplete?: () => void;
  photoMatchImage?: string | null;
}

export type { VisualAuditTabProps };

// =============================================================================
// Visual Audit Tab
// =============================================================================

export function VisualAuditTab({
  projectId,
  verificationContext,
  onVerificationComplete,
  photoMatchImage,
}: VisualAuditTabProps) {
  const [step, setStep] = useState<AuditStep>("upload");
  const [uploadedImage, setUploadedImage] = useState<string | null>(photoMatchImage || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when verification context changes
  useEffect(() => {
    if (verificationContext) {
      // Reset to upload state when starting a new verification
      setStep("upload");
      setUploadedImage(null);
      setResult(null);
    }
  }, [verificationContext]);

  // Update image when photoMatchImage changes (from BIM viewer overlay)
  useEffect(() => {
    if (photoMatchImage) {
      setUploadedImage(photoMatchImage);
      setStep("upload"); // Ready to analyze
    }
  }, [photoMatchImage]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setStep("analyzing");
      runAnalysis();
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setStep("analyzing");
      runAnalysis();
    };
    reader.readAsDataURL(file);
  }, []);

  // Simulate analysis (in production, this would call the server action)
  const runAnalysis = async () => {
    setIsAnalyzing(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mock result
    setResult({
      status: "warning",
      description: "Detected potential deviation in stair riser height. Estimated 7.5\" vs designed 7.0\".",
      confidence: 0.85,
      deviationPercentage: 7.1,
    });

    setIsAnalyzing(false);
    setStep("result");
  };

  // Reset to initial state
  const handleReset = () => {
    setStep("upload");
    setUploadedImage(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Clear verification context when resetting
    onVerificationComplete?.();
  };

  // Handle dismissing the verification context
  const handleDismissVerification = () => {
    onVerificationComplete?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Visual Audit</h3>
        </div>
        {step !== "upload" && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Verification Context Banner */}
      {verificationContext && (
        <div className="px-4 py-3 bg-primary/5 border-b border-border">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground-muted uppercase tracking-wide mb-1">
                Verifying Checklist Item
              </p>
              <p className="text-sm font-medium text-foreground">
                {verificationContext.requirement}
              </p>
              {verificationContext.codeReference && (
                <p className="text-xs font-mono text-primary mt-1">
                  {verificationContext.codeReference}
                </p>
              )}
            </div>
            <button
              onClick={handleDismissVerification}
              className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === "upload" && (
          <UploadSection
            onDrop={handleDrop}
            onFileSelect={() => fileInputRef.current?.click()}
            isVerifying={!!verificationContext}
          />
        )}

        {step === "analyzing" && uploadedImage && (
          <AnalyzingSection image={uploadedImage} />
        )}

        {step === "result" && uploadedImage && result && (
          <ResultSection image={uploadedImage} result={result} />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function UploadSection({
  onDrop,
  onFileSelect,
  isVerifying = false,
}: {
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: () => void;
  isVerifying?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground-muted">
        {isVerifying
          ? "Upload a photo to verify this checklist item. The AI will analyze the photo against the code requirement."
          : "Upload a construction photo to compare against the BIM model and detect geometric deviations."}
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { setIsDragging(false); onDrop(e); }}
        onClick={onFileSelect}
        className={`
          flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed
          transition-colors cursor-pointer
          ${isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
          }
        `}
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Camera className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          Upload Construction Photo
        </p>
        <p className="text-xs text-foreground-muted text-center">
          Drag & drop or click to browse
        </p>
      </div>

      {/* Features List */}
      <div className="space-y-2 pt-4">
        <h4 className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          Analysis Features
        </h4>
        <FeatureItem
          icon={<Ruler className="w-4 h-4" />}
          title="Geometric Variance"
          description="Compare As-Built vs BIM dimensions"
        />
        <FeatureItem
          icon={<Eye className="w-4 h-4" />}
          title="Visual Defect Detection"
          description="AI-powered defect identification"
        />
        <FeatureItem
          icon={<Scan className="w-4 h-4" />}
          title="Code Compliance Check"
          description="Auto-check against FBC requirements"
        />
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-hover/50">
      <div className="text-primary mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-foreground-muted">{description}</p>
      </div>
    </div>
  );
}

function AnalyzingSection({ image }: { image: string }) {
  return (
    <div className="space-y-4">
      {/* Image Preview */}
      <div className="relative rounded-lg overflow-hidden border border-border">
        <img
          src={image}
          alt="Uploaded photo"
          className="w-full h-48 object-cover"
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Scan className="absolute inset-0 m-auto w-5 h-5 text-primary" />
            </div>
            <p className="mt-3 text-sm font-medium text-white">Analyzing...</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="space-y-2">
        <ProgressStep label="Processing image" status="complete" />
        <ProgressStep label="Comparing with BIM model" status="active" />
        <ProgressStep label="Measuring deviations" status="pending" />
        <ProgressStep label="Running compliance check" status="pending" />
      </div>
    </div>
  );
}

function ProgressStep({
  label,
  status,
}: {
  label: string;
  status: "complete" | "active" | "pending";
}) {
  return (
    <div className="flex items-center gap-3">
      {status === "complete" ? (
        <CheckCircle2 className="w-5 h-5 text-success" />
      ) : status === "active" ? (
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-border" />
      )}
      <span className={status === "pending" ? "text-foreground-muted" : "text-foreground"}>
        {label}
      </span>
    </div>
  );
}

function ResultSection({
  image,
  result,
}: {
  image: string;
  result: AuditResult;
}) {
  const statusConfig = {
    pass: {
      bg: "bg-success/10",
      border: "border-success/30",
      text: "text-success",
      icon: <CheckCircle2 className="w-5 h-5" />,
      label: "Within Tolerance",
    },
    warning: {
      bg: "bg-warning/10",
      border: "border-warning/30",
      text: "text-warning",
      icon: <AlertTriangle className="w-5 h-5" />,
      label: "Deviation Detected",
    },
    fail: {
      bg: "bg-danger/10",
      border: "border-danger/30",
      text: "text-danger",
      icon: <AlertTriangle className="w-5 h-5" />,
      label: "Non-Compliant",
    },
  };

  const config = statusConfig[result.status];

  return (
    <div className="space-y-4">
      {/* Image with overlay */}
      <div className="relative rounded-lg overflow-hidden border border-border">
        <img
          src={image}
          alt="Analyzed photo"
          className="w-full h-48 object-cover"
        />
        {result.deviationPercentage && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs">
            {result.deviationPercentage > 0 ? "+" : ""}{result.deviationPercentage}% deviation
          </div>
        )}
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-lg ${config.bg} border ${config.border}`}>
        <div className="flex items-center gap-3">
          <div className={config.text}>{config.icon}</div>
          <div className="flex-1">
            <p className={`font-semibold ${config.text}`}>{config.label}</p>
            <p className="text-sm text-foreground-secondary mt-1">
              {result.description}
            </p>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground-muted">Confidence</span>
        <span className="font-medium text-foreground">
          {Math.round(result.confidence * 100)}%
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors">
          Create Issue
        </button>
        <button className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors">
          Run Code Check
        </button>
      </div>
    </div>
  );
}
