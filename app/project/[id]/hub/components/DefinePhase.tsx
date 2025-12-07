"use client";

import { useState, useRef, useCallback } from "react";
import {
  Box,
  FileText,
  Scale,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { BimEntitySummary } from "@/app/components/bim/BimEntitySummary";
import type { ProjectFile, BimEntityData } from "@/app/actions/files";
import {
  uploadProjectFile,
  saveBimData,
  deleteProjectFile,
} from "@/app/actions/files";

interface DefinePhaseProps {
  projectId: string;
  bimModel: ProjectFile | null;
  bimData: BimEntityData | null;
  specsCount: number;
  codeLibrarySelected: boolean;
  onBimModelChange: (model: ProjectFile | null) => void;
  onBimDataChange: (data: BimEntityData | null) => void;
  onAdvancePhase: () => void;
  canAdvance: boolean;
  onSpecsCountChange?: (count: number) => void;
}

export function DefinePhase({
  projectId,
  bimModel,
  bimData,
  specsCount,
  codeLibrarySelected,
  onBimModelChange,
  onBimDataChange,
  onAdvancePhase,
  canAdvance,
  onSpecsCountChange,
}: DefinePhaseProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isParsingIfc, setIsParsingIfc] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isUploadingSpec, setIsUploadingSpec] = useState(false);
  const [specUploadProgress, setSpecUploadProgress] = useState<string | null>(null);
  const [localSpecsCount, setLocalSpecsCount] = useState(specsCount);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specInputRef = useRef<HTMLInputElement>(null);

  // Handle BIM file upload
  const handleBimUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["glb", "gltf", "ifc"].includes(ext)) {
        alert("Please upload a GLB, GLTF, or IFC file");
        return;
      }

      setIsUploading(true);
      setUploadProgress("Reading file...");
      setParseError(null);

      try {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        setUploadProgress("Uploading to server...");

        const uploadedFile = await uploadProjectFile({
          project_id: projectId,
          file_name: file.name,
          file_type: ext as "glb" | "gltf" | "ifc",
          file_size_bytes: file.size,
          file_data: base64Data,
        });

        onBimModelChange(uploadedFile);
        setUploadProgress("Upload complete!");

        // Parse IFC if applicable
        if (ext === "ifc") {
          setIsParsingIfc(true);
          setUploadProgress("Analyzing BIM model...");

          try {
            const formData = new FormData();
            formData.append("file", file);

            const parseResponse = await fetch("/api/parse-ifc", {
              method: "POST",
              body: formData,
            });

            if (!parseResponse.ok) {
              const errorData = await parseResponse.json();
              throw new Error(errorData.error || "Failed to parse IFC file");
            }

            const parsedData = await parseResponse.json();
            await saveBimData(uploadedFile.id, projectId, parsedData);
            onBimDataChange(parsedData);
            setUploadProgress(
              `Found ${parsedData.totalElements.toLocaleString()} elements!`
            );
          } catch (parseErr) {
            console.error("IFC parsing failed:", parseErr);
            setParseError(
              parseErr instanceof Error ? parseErr.message : "Failed to parse IFC"
            );
            setUploadProgress("Upload complete (parsing failed)");
          } finally {
            setIsParsingIfc(false);
          }
        }

        setTimeout(() => setUploadProgress(null), 3000);
      } catch (err) {
        console.error("Upload failed:", err);
        setUploadProgress("Upload failed");
        setTimeout(() => setUploadProgress(null), 3000);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [projectId, onBimModelChange, onBimDataChange]
  );

  // Handle delete BIM model
  const handleDeleteModel = useCallback(async () => {
    if (!bimModel) return;
    if (!confirm("Are you sure you want to delete this BIM model?")) return;

    try {
      await deleteProjectFile(bimModel.id, projectId);
      onBimModelChange(null);
      onBimDataChange(null);
      setParseError(null);
    } catch (err) {
      console.error("Failed to delete model:", err);
      alert("Failed to delete model");
    }
  }, [bimModel, projectId, onBimModelChange, onBimDataChange]);

  // Handle spec PDF upload
  const handleSpecUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert("Please upload a PDF file");
        return;
      }

      setIsUploadingSpec(true);
      setSpecUploadProgress("Uploading specification...");

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);

        setSpecUploadProgress("Extracting requirements...");

        const response = await fetch("/api/ingest-spec", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to process specification");
        }

        // Update specs count
        const newCount = localSpecsCount + (data.specsInserted || 0);
        setLocalSpecsCount(newCount);
        onSpecsCountChange?.(newCount);

        setSpecUploadProgress(
          `Extracted ${data.specsInserted} specifications from ${file.name}`
        );
        setTimeout(() => setSpecUploadProgress(null), 5000);
      } catch (err) {
        console.error("Spec upload failed:", err);
        setSpecUploadProgress(
          err instanceof Error ? err.message : "Upload failed"
        );
        setTimeout(() => setSpecUploadProgress(null), 5000);
      } finally {
        setIsUploadingSpec(false);
        if (specInputRef.current) {
          specInputRef.current.value = "";
        }
      }
    },
    [projectId, localSpecsCount, onSpecsCountChange]
  );

  // Determine completion status for each card
  const bimComplete = !!bimModel;
  const specsComplete = localSpecsCount > 0;
  const codeComplete = codeLibrarySelected;

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Ingestion Center
        </h2>
        <p className="text-foreground-muted max-w-2xl mx-auto">
          Upload your project data to initialize the quality control system.
          Complete all three steps to proceed to the Planning phase.
        </p>
      </div>

      {/* Progress indicator */}
      {uploadProgress && (
        <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 mx-auto">
          {isUploading || isParsingIfc ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          ) : uploadProgress.includes("complete") ||
            uploadProgress.includes("Found") ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : uploadProgress.includes("failed") ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : null}
          <span className="text-sm text-foreground">{uploadProgress}</span>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {/* BIM Model Card */}
        <IngestionCard
          icon={<Box className="w-8 h-8" />}
          title="Upload BIM Model"
          description="Upload your 3D building model in IFC, GLB, or GLTF format for compliance analysis."
          complete={bimComplete}
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {bimModel ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {bimModel.file_name}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {formatFileSize(bimModel.file_size_bytes)}
                  </p>
                </div>
              </div>

              {/* BIM Summary */}
              {(bimData || isParsingIfc || parseError) && (
                <div className="p-3 bg-surface-hover rounded-lg">
                  <BimEntitySummary
                    data={bimData}
                    isParsing={isParsingIfc}
                    error={parseError}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Replace
                </button>
                <button
                  onClick={handleDeleteModel}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {isUploading ? "Uploading..." : "Select BIM File"}
            </button>
          )}
        </IngestionCard>

        {/* Specs Card */}
        <IngestionCard
          icon={<FileText className="w-8 h-8" />}
          title="Upload Project Specs"
          description="Upload your specification documents (PDF) for automated requirement extraction."
          complete={specsComplete}
          onClick={() => !isUploadingSpec && specInputRef.current?.click()}
          disabled={isUploadingSpec}
        >
          {/* Spec upload progress */}
          {specUploadProgress && (
            <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-primary/10 border border-primary/20">
              {isUploadingSpec ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
              ) : specUploadProgress.includes("Extracted") ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              )}
              <span className="text-sm text-foreground">{specUploadProgress}</span>
            </div>
          )}

          {specsComplete ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {localSpecsCount} specification{localSpecsCount !== 1 ? "s" : ""} loaded
                  </p>
                  <p className="text-xs text-foreground-muted">
                    Ready for compliance checking
                  </p>
                </div>
              </div>
              <button
                onClick={() => specInputRef.current?.click()}
                disabled={isUploadingSpec}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isUploadingSpec ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploadingSpec ? "Processing..." : "Add More Specs"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => specInputRef.current?.click()}
              disabled={isUploadingSpec}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {isUploadingSpec ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {isUploadingSpec ? "Processing..." : "Upload Spec PDF"}
            </button>
          )}
        </IngestionCard>

        {/* Building Code Card */}
        <IngestionCard
          icon={<Scale className="w-8 h-8" />}
          title="Select Building Code"
          description="Choose the applicable building code jurisdiction for compliance analysis."
          complete={codeComplete}
        >
          {codeComplete ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Florida Building Code 8th Ed.
                  </p>
                  <p className="text-xs text-foreground-muted">
                    Pre-configured for this project
                  </p>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
                Change Code
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <select className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select a code library...</option>
                <option value="fbc8">Florida Building Code 8th Ed.</option>
                <option value="ibc2021">IBC 2021</option>
                <option value="ibc2024">IBC 2024</option>
              </select>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors">
                <CheckCircle2 className="w-5 h-5" />
                Confirm Selection
              </button>
            </div>
          )}
        </IngestionCard>
      </div>

      {/* Initialize Button */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={onAdvancePhase}
          disabled={!canAdvance}
          className={`
            flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg
            transition-all duration-300
            ${canAdvance
              ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-105"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }
          `}
        >
          {canAdvance ? (
            <>
              Initialize Project
              <ArrowRight className="w-5 h-5" />
            </>
          ) : (
            <>
              Complete All Steps to Continue
            </>
          )}
        </button>
      </div>

      {/* Completion Status */}
      <div className="mt-4 flex justify-center gap-4 text-sm">
        <StatusChip complete={bimComplete} label="BIM Model" />
        <StatusChip complete={specsComplete} label="Specs" />
        <StatusChip complete={codeComplete} label="Building Code" />
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.ifc"
        onChange={handleBimUpload}
        className="hidden"
      />
      <input
        ref={specInputRef}
        type="file"
        accept=".pdf"
        onChange={handleSpecUpload}
        className="hidden"
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function IngestionCard({
  icon,
  title,
  description,
  complete,
  onClick,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  complete: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`
        flex flex-col p-6 rounded-xl border-2 transition-all duration-300
        ${complete
          ? "bg-emerald-500/5 border-emerald-500/30"
          : "bg-slate-900/50 border-slate-700 hover:border-slate-600"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`
            p-3 rounded-xl
            ${complete ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}
          `}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-foreground-muted mt-1">{description}</p>
        </div>
        {complete && (
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-end">{children}</div>
    </div>
  );
}

function StatusChip({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div
      className={`
        flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
        ${complete
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-slate-800 text-slate-500"
        }
      `}
    >
      {complete ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />
      )}
      {label}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
