"use client";

import { useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/app/components/layout";
import {
  BimViewer,
  HiddenBimRenderer,
  ComplianceAnalyzer,
} from "@/app/components/dashboard";
import type {
  HiddenBimRendererRef,
  ColorToIdEntry,
  CameraState,
} from "@/app/components/dashboard/HiddenBimRenderer";
import type { BimElementData, CameraStateData } from "@/app/components/dashboard/BimViewer";
import {
  analyzeVisualDefect,
  type VisualDefectResult,
  type VisualDefectError,
} from "@/app/actions/analyzeVisualDefect";
import {
  analyzeGeometricVariance,
  type GeometricVarianceResult,
  type GeometricVarianceError,
  type BimMetadata,
} from "@/app/actions/analyzeGeometricVariance";
import {
  Upload,
  Camera,
  Scan,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  Eye,
  RotateCcw,
  Zap,
  ChevronRight,
  Info,
  Ruler,
  Triangle,
  ArrowUpDown,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

type AnalysisMode = "defect" | "variance";

type AnalysisStep =
  | "upload"
  | "photo-match"
  | "align"
  | "select-element"
  | "analyzing"
  | "variance-result"
  | "identified"
  | "complete";

interface VarianceOverlay {
  show: boolean;
  hasDeviation: boolean;
  deviationPercentage: number;
  designedValue: number;
  estimatedValue: number;
  unit: string;
  dimensionLabel: string;
}

interface AnalysisState {
  step: AnalysisStep;
  mode: AnalysisMode;
  uploadedImage: string | null;
  syntheticSnapshot: string | null;
  colorMap: Record<string, ColorToIdEntry> | null;
  // Visual defect detection
  visualResult: VisualDefectResult | null;
  visualError: VisualDefectError | null;
  // Geometric variance
  varianceResult: GeometricVarianceResult | null;
  varianceError: GeometricVarianceError | null;
  selectedDimension: BimMetadata | null;
  // Compliance
  complianceQuery: string | null;
  // Overlay
  overlay: VarianceOverlay;
}

// =============================================================================
// Dimension options for variance analysis
// =============================================================================

const DIMENSION_OPTIONS: Record<string, BimMetadata[]> = {
  stairway: [
    {
      element: "",
      dimensionType: "riserHeight",
      designedValue: 7,
      unit: "inches",
      dimensionLabel: "Riser Height",
      codeRequirement: { minimum: 4, maximum: 7.75, codeReference: "FBC 1011.5.2" },
    },
    {
      element: "",
      dimensionType: "treadDepth",
      designedValue: 11,
      unit: "inches",
      dimensionLabel: "Tread Depth",
      codeRequirement: { minimum: 11, codeReference: "FBC 1011.5.2" },
    },
    {
      element: "",
      dimensionType: "stairWidth",
      designedValue: 44,
      unit: "inches",
      dimensionLabel: "Stair Width",
      codeRequirement: { minimum: 44, codeReference: "FBC 1011.2" },
    },
    {
      element: "",
      dimensionType: "headroom",
      designedValue: 80,
      unit: "inches",
      dimensionLabel: "Headroom",
      codeRequirement: { minimum: 80, codeReference: "FBC 1011.3" },
    },
  ],
  spiral_stairway: [
    {
      element: "",
      dimensionType: "riserHeight",
      designedValue: 9.5,
      unit: "inches",
      dimensionLabel: "Riser Height",
      codeRequirement: { maximum: 9.5, codeReference: "FBC 1011.10" },
    },
    {
      element: "",
      dimensionType: "treadDepth",
      designedValue: 6.75,
      unit: "inches",
      dimensionLabel: "Tread Depth (at 12\" from edge)",
      codeRequirement: { minimum: 6.75, codeReference: "FBC 1011.10" },
    },
    {
      element: "",
      dimensionType: "headroom",
      designedValue: 78,
      unit: "inches",
      dimensionLabel: "Headroom",
      codeRequirement: { minimum: 78, codeReference: "FBC 1011.10" },
    },
  ],
  door: [
    {
      element: "",
      dimensionType: "doorWidth",
      designedValue: 32,
      unit: "inches",
      dimensionLabel: "Door Width",
      codeRequirement: { minimum: 32, codeReference: "FBC 1010.1.1" },
    },
    {
      element: "",
      dimensionType: "doorHeight",
      designedValue: 80,
      unit: "inches",
      dimensionLabel: "Door Height",
      codeRequirement: { minimum: 80, codeReference: "FBC 1010.1.1" },
    },
  ],
  corridor: [
    {
      element: "",
      dimensionType: "corridorWidth",
      designedValue: 44,
      unit: "inches",
      dimensionLabel: "Corridor Width",
      codeRequirement: { minimum: 44, codeReference: "FBC 1020.2" },
    },
  ],
  ramp: [
    {
      element: "",
      dimensionType: "rampSlope",
      designedValue: 8.33,
      unit: "ratio",
      dimensionLabel: "Ramp Slope (1:X)",
      codeRequirement: { minimum: 12, codeReference: "FBC 1012.2" },
    },
    {
      element: "",
      dimensionType: "handrailHeight",
      designedValue: 34,
      unit: "inches",
      dimensionLabel: "Handrail Height",
      codeRequirement: { minimum: 34, maximum: 38, codeReference: "FBC 1012.8" },
    },
  ],
};

// =============================================================================
// Main Component
// =============================================================================

export default function ScanAnalysisPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Refs
  const hiddenRendererRef = useRef<HiddenBimRendererRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [state, setState] = useState<AnalysisState>({
    step: "upload",
    mode: "variance",
    uploadedImage: null,
    syntheticSnapshot: null,
    colorMap: null,
    visualResult: null,
    visualError: null,
    varianceResult: null,
    varianceError: null,
    selectedDimension: null,
    complianceQuery: null,
    overlay: {
      show: false,
      hasDeviation: false,
      deviationPercentage: 0,
      designedValue: 0,
      estimatedValue: 0,
      unit: "",
      dimensionLabel: "",
    },
  });

  const [cameraState, setCameraState] = useState<CameraState>({
    position: { x: 15, y: 12, z: 15 },
    rotation: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
  });

  const [isHiddenRendererReady, setIsHiddenRendererReady] = useState(false);
  const [selectedBimElement, setSelectedBimElement] = useState<BimElementData | null>(null);

  // Handle hidden renderer ready
  const handleHiddenRendererReady = useCallback(
    (colorMap: Record<string, ColorToIdEntry>) => {
      console.log("[ScanAnalysis] Hidden renderer ready with", Object.keys(colorMap).length, "colors");
      setState((prev) => ({ ...prev, colorMap }));
      setIsHiddenRendererReady(true);
    },
    []
  );

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
      const dataUrl = e.target?.result as string;
      setState((prev) => ({
        ...prev,
        step: "photo-match",
        uploadedImage: dataUrl,
        visualResult: null,
        visualError: null,
        varianceResult: null,
        varianceError: null,
        complianceQuery: null,
        overlay: { ...prev.overlay, show: false },
      }));
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
      const dataUrl = e.target?.result as string;
      setState((prev) => ({
        ...prev,
        step: "photo-match",
        uploadedImage: dataUrl,
        visualResult: null,
        visualError: null,
        varianceResult: null,
        varianceError: null,
        complianceQuery: null,
        overlay: { ...prev.overlay, show: false },
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle BIM element selection
  const handleSelectElement = useCallback((element: BimElementData) => {
    console.log("[ScanAnalysis] Element selected:", element);
    setSelectedBimElement(element);
  }, []);

  // Handle Lock & Analyze from Photo Match Mode
  const handleLockAndAnalyze = useCallback((cameraState: CameraStateData) => {
    console.log("[ScanAnalysis] Camera locked:", cameraState);
    // Update our camera state to sync with hidden renderer
    setCameraState({
      position: cameraState.position,
      rotation: cameraState.rotation,
      target: cameraState.target,
    });
    // Move to the next step
    setState((prev) => ({ ...prev, step: "align" }));
  }, []);

  // Proceed to element selection for variance mode
  const handleProceedToSelect = useCallback(() => {
    setState((prev) => ({ ...prev, step: "select-element" }));
  }, []);

  // Handle dimension selection and run variance analysis
  const handleRunVarianceAnalysis = useCallback(
    async (dimension: BimMetadata) => {
      if (!state.uploadedImage || !hiddenRendererRef.current || !selectedBimElement) {
        console.error("[ScanAnalysis] Missing required data");
        return;
      }

      // Get designed value from BIM element userData
      const userData = selectedBimElement.userData as Record<string, unknown> | undefined;
      let designedValue = dimension.designedValue;

      // Try to get actual value from BIM data
      if (userData) {
        const bimValue = userData[dimension.dimensionType] as number | undefined;
        if (bimValue !== undefined) {
          designedValue = bimValue;
        }
      }

      const fullDimension: BimMetadata = {
        ...dimension,
        element: selectedBimElement.name,
        designedValue,
      };

      setState((prev) => ({
        ...prev,
        step: "analyzing",
        selectedDimension: fullDimension,
      }));

      // Update camera and capture snapshot
      hiddenRendererRef.current.updateCamera(cameraState);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const syntheticSnapshot = hiddenRendererRef.current.captureSnapshot();
      if (!syntheticSnapshot) {
        console.error("[ScanAnalysis] Failed to capture snapshot");
        return;
      }

      setState((prev) => ({ ...prev, syntheticSnapshot }));

      console.log("[ScanAnalysis] Starting geometric variance analysis...");
      console.log(`[ScanAnalysis] Element: ${selectedBimElement.name}, Dimension: ${dimension.dimensionLabel}`);

      try {
        const result = await analyzeGeometricVariance({
          realImage: state.uploadedImage,
          syntheticImage: syntheticSnapshot,
          bimMetadata: fullDimension,
        });

        if ("error" in result) {
          console.log("[ScanAnalysis] Variance analysis error:", result);
          setState((prev) => ({
            ...prev,
            step: "complete",
            varianceError: result,
          }));
          return;
        }

        console.log("[ScanAnalysis] Variance analysis success:", result);

        // Build compliance query if there's a deviation
        let complianceQuery: string | null = null;
        if (result.hasVisualDeviation) {
          const elementType = (userData?.elementType as string) || "element";
          complianceQuery = `A ${elementType.replace(/_/g, " ")} has a ${dimension.dimensionLabel?.toLowerCase() || dimension.dimensionType} measured at ${result.estimatedDimension} ${dimension.unit}. The designed value was ${designedValue} ${dimension.unit}. Is this compliant with Florida Building Code${dimension.codeRequirement?.codeReference ? ` ${dimension.codeRequirement.codeReference}` : ""}?`;
        }

        setState((prev) => ({
          ...prev,
          step: "variance-result",
          varianceResult: result,
          complianceQuery,
          overlay: {
            show: true,
            hasDeviation: result.hasVisualDeviation,
            deviationPercentage: result.deviationPercentage,
            designedValue,
            estimatedValue: result.estimatedDimension,
            unit: dimension.unit,
            dimensionLabel: dimension.dimensionLabel || dimension.dimensionType,
          },
        }));
      } catch (error) {
        console.error("[ScanAnalysis] Variance analysis failed:", error);
        setState((prev) => ({
          ...prev,
          step: "complete",
          varianceError: {
            error: error instanceof Error ? error.message : "Unknown error",
            code: "ANALYSIS_FAILED",
          },
        }));
      }
    },
    [state.uploadedImage, selectedBimElement, cameraState]
  );

  // Run visual defect analysis (original mode)
  const handleRunDefectAnalysis = useCallback(async () => {
    if (!state.uploadedImage || !state.colorMap || !hiddenRendererRef.current) {
      console.error("[ScanAnalysis] Missing required data");
      return;
    }

    hiddenRendererRef.current.updateCamera(cameraState);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const syntheticSnapshot = hiddenRendererRef.current.captureSnapshot();
    if (!syntheticSnapshot) {
      console.error("[ScanAnalysis] Failed to capture snapshot");
      return;
    }

    setState((prev) => ({
      ...prev,
      step: "analyzing",
      syntheticSnapshot,
    }));

    try {
      const result = await analyzeVisualDefect({
        realImage: state.uploadedImage,
        syntheticImage: syntheticSnapshot,
        colorMap: state.colorMap,
      });

      if ("error" in result) {
        setState((prev) => ({
          ...prev,
          step: "complete",
          visualError: result,
        }));
        return;
      }

      const elementData = result.elementData;
      let complianceQuery = result.defectDescription;

      if (elementData?.userData) {
        const userData = elementData.userData as Record<string, unknown>;
        const elementType = userData.elementType as string | undefined;

        if (elementType) {
          const measurements: string[] = [];
          if (userData.stairWidth) measurements.push(`width: ${userData.stairWidth}"`);
          if (userData.riserHeight) measurements.push(`riser height: ${userData.riserHeight}"`);
          if (userData.treadDepth) measurements.push(`tread depth: ${userData.treadDepth}"`);
          if (userData.headroom) measurements.push(`headroom: ${userData.headroom}"`);

          if (measurements.length > 0) {
            complianceQuery += ` The ${elementType.replace(/_/g, " ")} has: ${measurements.join(", ")}. Is this compliant with Florida Building Code?`;
          }
        }
      }

      setState((prev) => ({
        ...prev,
        step: "identified",
        visualResult: result,
        complianceQuery,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: "complete",
        visualError: {
          error: error instanceof Error ? error.message : "Unknown error",
          code: "ANALYSIS_FAILED",
        },
      }));
    }
  }, [state.uploadedImage, state.colorMap, cameraState]);

  // Reset
  const handleReset = useCallback(() => {
    setState({
      step: "upload",
      mode: state.mode,
      uploadedImage: null,
      syntheticSnapshot: null,
      colorMap: state.colorMap,
      visualResult: null,
      visualError: null,
      varianceResult: null,
      varianceError: null,
      selectedDimension: null,
      complianceQuery: null,
      overlay: {
        show: false,
        hasDeviation: false,
        deviationPercentage: 0,
        designedValue: 0,
        estimatedValue: 0,
        unit: "",
        dimensionLabel: "",
      },
    });
    setSelectedBimElement(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [state.colorMap, state.mode]);

  // Toggle mode
  const handleModeChange = useCallback((mode: AnalysisMode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  return (
    <DashboardShell
      title="Visual Scan Analysis"
      description="Upload a construction photo for AI-powered analysis"
      actions={
        state.step !== "upload" && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Start Over
          </button>
        )
      }
    >
      {/* Hidden BIM Renderer */}
      <HiddenBimRenderer
        ref={hiddenRendererRef}
        width={1024}
        height={768}
        initialCamera={cameraState}
        onReady={handleHiddenRendererReady}
        onError={(error) => console.error("[ScanAnalysis] Hidden renderer error:", error)}
      />

      {/* Mode Selector */}
      {state.step === "upload" && (
        <div className="mb-6">
          <ModeSelector mode={state.mode} onModeChange={handleModeChange} />
        </div>
      )}

      {/* Progress Steps */}
      <div className="mb-6">
        <ProgressSteps currentStep={state.step} mode={state.mode} />
      </div>

      {/* Photo Match Mode - Full Width BimViewer */}
      {state.step === "photo-match" && state.uploadedImage && (
        <div className="mb-6">
          <div className="card p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Align BIM to Photo</h3>
                <p className="text-sm text-foreground-muted">
                  Rotate and zoom the 3D ghost overlay until it matches your photo, then click "Lock & Analyze"
                </p>
              </div>
            </div>
          </div>
          <div className="h-[600px]">
            <BimViewer
              title="Photo Match Mode"
              pointCount="Align to photo"
              photoMatchMode={true}
              photoMatchImage={state.uploadedImage}
              onLockAndAnalyze={handleLockAndAnalyze}
            />
          </div>
        </div>
      )}

      {/* Main Content Grid - visible for upload and other steps */}
      {state.step !== "photo-match" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Photo Upload / Preview */}
          <div className="space-y-4">
            {state.step === "upload" ? (
              <UploadPanel
                onFileSelect={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                isReady={isHiddenRendererReady}
                mode={state.mode}
              />
            ) : (
              <PhotoPreviewWithOverlay
                imageUrl={state.uploadedImage}
                syntheticUrl={state.syntheticSnapshot}
                showSynthetic={["analyzing", "variance-result", "identified", "complete"].includes(state.step)}
                overlay={state.overlay}
              />
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Right Column: Analysis Flow */}
          <div className="space-y-4">
            {state.step === "align" && (
              <AlignPanel
                mode={state.mode}
                isReady={isHiddenRendererReady}
                onRunDefectAnalysis={handleRunDefectAnalysis}
                onProceedToSelect={handleProceedToSelect}
              />
            )}

            {state.step === "align" && (
              <div className="h-[400px]">
                <BimViewer
                  title="Confirm Alignment"
                  pointCount="Drag to fine-tune"
                  onSelectElement={handleSelectElement}
                />
              </div>
            )}

            {state.step === "select-element" && (
              <ElementSelectionPanel
                selectedElement={selectedBimElement}
                onSelectDimension={handleRunVarianceAnalysis}
                onBack={() => setState((prev) => ({ ...prev, step: "photo-match" }))}
              />
            )}

            {state.step === "select-element" && (
              <div className="h-[400px]">
                <BimViewer
                  title="Select Element"
                  pointCount="Click an element"
                  onSelectElement={handleSelectElement}
                />
              </div>
            )}

            {state.step === "analyzing" && (
              <AnalyzingPanel mode={state.mode} />
            )}

            {state.step === "variance-result" && state.varianceResult && (
              <VarianceResultPanel
                result={state.varianceResult}
                dimension={state.selectedDimension}
                element={selectedBimElement}
              />
            )}

            {state.step === "identified" && state.visualResult && (
              <IdentifiedElementPanel result={state.visualResult} />
            )}

            {state.step === "complete" && (state.visualError || state.varianceError) && (
              <ErrorPanel
                error={state.visualError || state.varianceError!}
                onRetry={handleReset}
              />
            )}
          </div>
        </div>
      )}

      {/* Compliance Analysis Section */}
      {(state.step === "variance-result" || state.step === "identified") && state.complianceQuery && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              SUPER RAG Compliance Analysis
            </h2>
          </div>
          <ComplianceAnalyzer
            projectId={projectId}
            initialQuery={state.complianceQuery}
            inline
          />
        </div>
      )}
    </DashboardShell>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

function ModeSelector({
  mode,
  onModeChange,
}: {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 p-1 bg-surface-hover rounded-lg max-w-md mx-auto">
      <button
        onClick={() => onModeChange("variance")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          mode === "variance"
            ? "bg-primary text-white"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        <Ruler className="w-4 h-4" />
        Geometric Variance
      </button>
      <button
        onClick={() => onModeChange("defect")}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          mode === "defect"
            ? "bg-primary text-white"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        <Scan className="w-4 h-4" />
        Defect Detection
      </button>
    </div>
  );
}

function ProgressSteps({ currentStep, mode }: { currentStep: AnalysisStep; mode: AnalysisMode }) {
  const varianceSteps = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "photo-match", label: "Align", icon: Eye },
    { id: "select-element", label: "Select", icon: Triangle },
    { id: "variance-result", label: "Result", icon: ArrowUpDown },
  ];

  const defectSteps = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "photo-match", label: "Align", icon: Eye },
    { id: "analyzing", label: "Analyze", icon: Scan },
    { id: "identified", label: "Result", icon: CheckCircle2 },
  ];

  const steps = mode === "variance" ? varianceSteps : defectSteps;
  const stepOrder = mode === "variance"
    ? ["upload", "photo-match", "align", "select-element", "analyzing", "variance-result", "complete"]
    : ["upload", "photo-match", "align", "analyzing", "identified", "complete"];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center justify-between max-w-lg mx-auto">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const stepIndex = stepOrder.indexOf(step.id);
        const isCompleted = currentIndex > stepIndex;
        const isCurrent = step.id === currentStep ||
          (currentStep === "align" && step.id === "photo-match") || // align is sub-step of photo-match
          (currentStep === "analyzing" && step.id === "select-element" && mode === "variance") ||
          (currentStep === "complete" && index === steps.length - 1);

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted
                    ? "bg-success text-white"
                    : isCurrent
                    ? "bg-primary text-white"
                    : "bg-surface-hover text-foreground-muted border border-border"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`mt-1 text-xs font-medium ${isCurrent ? "text-foreground" : "text-foreground-muted"}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-foreground-muted mx-1 mt-[-16px]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadPanel({
  onFileSelect,
  onDrop,
  isReady,
  mode,
}: {
  onFileSelect: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  isReady: boolean;
  mode: AnalysisMode;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { setIsDragging(false); onDrop(e); }}
      className={`card p-8 border-2 border-dashed transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Upload Construction Photo
        </h3>
        <p className="text-sm text-foreground-muted mb-6 max-w-sm">
          {mode === "variance"
            ? "Upload a photo to compare As-Built dimensions against the BIM model."
            : "Upload a photo to detect visual defects and identify affected BIM elements."}
        </p>

        <button
          onClick={onFileSelect}
          disabled={!isReady}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white rounded-lg font-medium transition-colors"
        >
          <Upload className="w-5 h-5" />
          {isReady ? "Select Photo" : "Initializing..."}
        </button>

        {!isReady && (
          <div className="flex items-center gap-2 mt-4 text-sm text-foreground-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing BIM renderer...
          </div>
        )}
      </div>
    </div>
  );
}

function AlignPanel({
  mode,
  isReady,
  onRunDefectAnalysis,
  onProceedToSelect,
}: {
  mode: AnalysisMode;
  isReady: boolean;
  onRunDefectAnalysis: () => void;
  onProceedToSelect: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Eye className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">Align Camera View</h3>
          <p className="text-sm text-foreground-muted">
            Rotate the 3D model to match your photo angle
          </p>
        </div>
      </div>
      <p className="text-xs text-foreground-muted mb-4">
        Tip: Match the perspective of your photo for accurate comparison.
      </p>
      <button
        onClick={mode === "variance" ? onProceedToSelect : onRunDefectAnalysis}
        disabled={!isReady}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white rounded-lg font-medium transition-colors"
      >
        {mode === "variance" ? (
          <>
            <Triangle className="w-5 h-5" />
            Select Element to Measure
          </>
        ) : (
          <>
            <Scan className="w-5 h-5" />
            Run Visual Analysis
          </>
        )}
      </button>
    </div>
  );
}

function ElementSelectionPanel({
  selectedElement,
  onSelectDimension,
  onBack,
}: {
  selectedElement: BimElementData | null;
  onSelectDimension: (dimension: BimMetadata) => void;
  onBack: () => void;
}) {
  const userData = selectedElement?.userData as Record<string, unknown> | undefined;
  const elementType = (userData?.elementType as string) || "unknown";
  const dimensions = DIMENSION_OPTIONS[elementType] || [];

  return (
    <div className="card overflow-hidden">
      <div className="p-4 bg-primary/5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Triangle className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-medium text-foreground">Select Dimension to Check</h3>
              <p className="text-sm text-foreground-muted">
                {selectedElement ? `Element: ${selectedElement.name}` : "Click an element in the 3D viewer"}
              </p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-sm text-foreground-muted hover:text-foreground"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="p-4">
        {selectedElement ? (
          dimensions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-foreground-muted uppercase tracking-wide mb-3">
                Available Dimensions for {elementType.replace(/_/g, " ")}
              </p>
              {dimensions.map((dim, i) => {
                // Get actual value from BIM if available
                const bimValue = userData?.[dim.dimensionType] as number | undefined;
                const displayValue = bimValue ?? dim.designedValue;

                return (
                  <button
                    key={i}
                    onClick={() => onSelectDimension(dim)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-foreground">{dim.dimensionLabel}</p>
                      <p className="text-xs text-foreground-muted">
                        BIM Value: {displayValue} {dim.unit}
                        {dim.codeRequirement && (
                          <span className="ml-2 text-primary">
                            ({dim.codeRequirement.codeReference})
                          </span>
                        )}
                      </p>
                    </div>
                    <Ruler className="w-4 h-4 text-foreground-muted" />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted text-center py-4">
              No dimension checks available for this element type.
            </p>
          )
        ) : (
          <div className="text-center py-8">
            <Triangle className="w-12 h-12 text-foreground-muted mx-auto mb-3 opacity-50" />
            <p className="text-sm text-foreground-muted">
              Click on an element in the 3D viewer to select it
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoPreviewWithOverlay({
  imageUrl,
  syntheticUrl,
  showSynthetic,
  overlay,
}: {
  imageUrl: string | null;
  syntheticUrl: string | null;
  showSynthetic: boolean;
  overlay: VarianceOverlay;
}) {
  const [showingReal, setShowingReal] = useState(true);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border bg-surface-hover/30">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-foreground-muted" />
          <span className="text-sm font-medium text-foreground">
            {showingReal ? "As-Built Photo" : "BIM Render"}
          </span>
        </div>
        {showSynthetic && syntheticUrl && (
          <div className="flex items-center gap-1 bg-surface rounded-lg p-1">
            <button
              onClick={() => setShowingReal(true)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                showingReal ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Photo
            </button>
            <button
              onClick={() => setShowingReal(false)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                !showingReal ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground"
              }`}
            >
              BIM
            </button>
          </div>
        )}
      </div>

      <div className="relative aspect-[4/3] bg-black flex items-center justify-center">
        {(showingReal ? imageUrl : syntheticUrl) ? (
          <>
            <img
              src={showingReal ? imageUrl! : syntheticUrl!}
              alt={showingReal ? "As-Built photo" : "BIM Render"}
              className="max-w-full max-h-full object-contain"
            />

            {/* Deviation Overlay */}
            {overlay.show && showingReal && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Yellow dashed box (BIM/Designed) */}
                <div
                  className="absolute border-2 border-dashed border-yellow-400"
                  style={{
                    top: "30%",
                    left: "25%",
                    width: "50%",
                    height: "40%",
                  }}
                />

                {/* Red solid box (Actual/Deviation) */}
                {overlay.hasDeviation && (
                  <div
                    className="absolute border-3 border-solid border-red-500"
                    style={{
                      top: overlay.deviationPercentage > 0 ? "28%" : "32%",
                      left: "24%",
                      width: "52%",
                      height: overlay.deviationPercentage > 0 ? "44%" : "36%",
                    }}
                  />
                )}

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-black/80 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-0.5 border border-dashed border-yellow-400" />
                    <span className="text-yellow-400">As-Designed (BIM)</span>
                  </div>
                  {overlay.hasDeviation && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-red-500" />
                      <span className="text-red-400">As-Built (Detected)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-foreground-muted">No image</div>
        )}
      </div>
    </div>
  );
}

function AnalyzingPanel({ mode }: { mode: AnalysisMode }) {
  const steps = mode === "variance"
    ? [
        { label: "Capturing BIM render", status: "complete" as const },
        { label: "Comparing geometries", status: "active" as const },
        { label: "Estimating dimensions", status: "pending" as const },
        { label: "Checking compliance", status: "pending" as const },
      ]
    : [
        { label: "Processing photo", status: "complete" as const },
        { label: "Generating ID map", status: "complete" as const },
        { label: "Running vision analysis", status: "active" as const },
        { label: "Matching to BIM", status: "pending" as const },
      ];

  return (
    <div className="card p-8">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            {mode === "variance" ? (
              <Ruler className="w-8 h-8 text-primary" />
            ) : (
              <Scan className="w-8 h-8 text-primary" />
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2">
          {mode === "variance" ? "Analyzing Geometric Variance" : "Analyzing Visual Defect"}
        </h3>
        <p className="text-sm text-foreground-muted mb-6 max-w-sm">
          {mode === "variance"
            ? "Comparing As-Built dimensions against the BIM model..."
            : "Comparing your photo against the BIM model..."}
        </p>

        <div className="space-y-3 text-sm w-full max-w-xs">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {step.status === "complete" ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : step.status === "active" ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-border" />
              )}
              <span className={step.status === "pending" ? "text-foreground-muted" : "text-foreground"}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VarianceResultPanel({
  result,
  dimension,
  element,
}: {
  result: GeometricVarianceResult;
  dimension: BimMetadata | null;
  element: BimElementData | null;
}) {
  const isCompliant = result.complianceAssessment?.isCompliant ?? true;
  const hasDeviation = result.hasVisualDeviation;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div
        className={`p-4 border-b ${
          !isCompliant
            ? "bg-danger/10 border-danger/30"
            : hasDeviation
            ? "bg-warning/10 border-warning/30"
            : "bg-success/10 border-success/30"
        }`}
      >
        <div className="flex items-center gap-3">
          {!isCompliant ? (
            <XCircle className="w-6 h-6 text-danger" />
          ) : hasDeviation ? (
            <AlertTriangle className="w-6 h-6 text-warning" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-success" />
          )}
          <div>
            <h3 className="font-semibold text-foreground">
              {!isCompliant
                ? "Non-Compliant - Code Violation"
                : hasDeviation
                ? "Deviation Detected"
                : "Within Tolerance"}
            </h3>
            <p className="text-sm text-foreground-muted">
              Confidence: {Math.round(result.deviationDetails.confidence * 100)}%
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Element Info */}
        <div>
          <label className="text-xs text-foreground-muted uppercase tracking-wide">Element</label>
          <p className="text-lg font-mono text-primary mt-1">{element?.name || "Unknown"}</p>
        </div>

        {/* Dimension Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-surface-hover border border-border">
            <p className="text-xs text-foreground-muted uppercase tracking-wide">As-Designed (BIM)</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {dimension?.designedValue} <span className="text-sm font-normal">{dimension?.unit}</span>
            </p>
            <p className="text-xs text-yellow-500 mt-1">● Ground Truth</p>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              !isCompliant
                ? "bg-danger/5 border-danger/30"
                : hasDeviation
                ? "bg-warning/5 border-warning/30"
                : "bg-success/5 border-success/30"
            }`}
          >
            <p className="text-xs text-foreground-muted uppercase tracking-wide">As-Built (Estimated)</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {result.estimatedDimension} <span className="text-sm font-normal">{dimension?.unit}</span>
            </p>
            <p
              className={`text-xs mt-1 ${
                !isCompliant ? "text-danger" : hasDeviation ? "text-warning" : "text-success"
              }`}
            >
              {result.deviationPercentage > 0 ? "+" : ""}
              {result.deviationPercentage}% deviation
            </p>
          </div>
        </div>

        {/* Code Requirement */}
        {result.complianceAssessment && (
          <div
            className={`p-3 rounded-lg border ${
              isCompliant ? "bg-success/5 border-success/30" : "bg-danger/5 border-danger/30"
            }`}
          >
            <div className="flex items-start gap-2">
              {isCompliant ? (
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-danger mt-0.5" />
              )}
              <div>
                <p className={`text-sm font-medium ${isCompliant ? "text-success" : "text-danger"}`}>
                  {isCompliant ? "Meets Code Requirements" : "Code Violation"}
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  {result.complianceAssessment.explanation}
                </p>
                {result.complianceAssessment.codeReference && (
                  <p className="text-xs text-primary mt-1 font-mono">
                    {result.complianceAssessment.codeReference}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Visual Reasoning */}
        <div>
          <label className="text-xs text-foreground-muted uppercase tracking-wide">AI Analysis</label>
          <p className="text-sm text-foreground mt-1">{result.visualReasoning}</p>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Info className="w-4 h-4 text-primary mt-0.5" />
          <p className="text-xs text-foreground-muted">
            {hasDeviation
              ? "Running detailed SUPER RAG compliance analysis below..."
              : "No significant deviation detected. Element appears to match BIM specifications."}
          </p>
        </div>
      </div>
    </div>
  );
}

function IdentifiedElementPanel({ result }: { result: VisualDefectResult }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 bg-success/10 border-b border-success/30">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-success" />
          <div>
            <h3 className="font-semibold text-foreground">Element Identified</h3>
            <p className="text-sm text-foreground-muted">
              Confidence: {Math.round(result.confidence * 100)}%
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-foreground-muted uppercase tracking-wide">BIM Element</label>
          <p className="text-lg font-mono text-primary mt-1">{result.elementName}</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-foreground-muted uppercase tracking-wide">ID Color</label>
          <div
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: result.identifiedColor }}
          />
          <span className="text-sm font-mono text-foreground-muted">{result.identifiedColor}</span>
        </div>

        <div>
          <label className="text-xs text-foreground-muted uppercase tracking-wide">Detected Defect</label>
          <p className="text-sm text-foreground mt-1">{result.defectDescription}</p>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Info className="w-4 h-4 text-primary mt-0.5" />
          <p className="text-xs text-foreground-muted">
            Running SUPER RAG compliance analysis...
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({
  error,
  onRetry,
}: {
  error: VisualDefectError | GeometricVarianceError;
  onRetry: () => void;
}) {
  const code = error.code;
  const errorConfig: Record<string, { icon: typeof XCircle; color: string; title: string; description: string }> = {
    NO_DEFECT_FOUND: {
      icon: AlertTriangle,
      color: "warning",
      title: "No Defect Detected",
      description: "The AI could not identify a clear visual defect.",
    },
    COLOR_NOT_IN_MAP: {
      icon: XCircle,
      color: "danger",
      title: "Element Not Found",
      description: "Could not match to a BIM element.",
    },
    ANALYSIS_FAILED: {
      icon: XCircle,
      color: "danger",
      title: "Analysis Failed",
      description: "An error occurred during analysis.",
    },
    INVALID_INPUT: {
      icon: XCircle,
      color: "danger",
      title: "Invalid Input",
      description: "The provided data was invalid.",
    },
    CANNOT_COMPARE: {
      icon: AlertTriangle,
      color: "warning",
      title: "Cannot Compare",
      description: "Unable to compare the images.",
    },
    LOW_CONFIDENCE: {
      icon: AlertTriangle,
      color: "warning",
      title: "Low Confidence",
      description: "Analysis confidence too low for reliable results.",
    },
  };

  const config = errorConfig[code] || errorConfig.ANALYSIS_FAILED;
  const Icon = config.icon;

  return (
    <div className="card p-6">
      <div className="flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-full bg-${config.color}/10 flex items-center justify-center mb-4`}>
          <Icon className={`w-8 h-8 text-${config.color}`} />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{config.title}</h3>
        <p className="text-sm text-foreground-muted mb-2">{config.description}</p>
        <p className="text-xs text-foreground-muted mb-6 font-mono">{error.error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
