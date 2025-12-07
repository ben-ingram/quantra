"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getProject, type Project } from "@/app/actions/projects";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Box,
  MoreVertical,
  Loader2,
  Search,
  Grid,
  List,
  Download,
  Trash2,
  Eye,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface ProjectFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: "glb" | "gltf" | "ifc" | "pdf" | "jpg" | "jpeg" | "png" | "dwg" | "rvt";
  file_size_bytes: number | null;
  uploaded_at: string;
}

type FileCategory = "all" | "3d" | "documents" | "images";

// =============================================================================
// Documents Page
// =============================================================================

export default function DocumentsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<FileCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const projectData = await getProject(projectId);
        setProject(projectData);
        // TODO: Load files from Supabase
        setFiles([]);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [projectId]);

  const filteredFiles = files.filter((file) => {
    // Search filter
    if (searchQuery && !file.file_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Category filter
    if (category === "3d") {
      return ["glb", "gltf", "ifc", "dwg", "rvt"].includes(file.file_type);
    }
    if (category === "documents") {
      return file.file_type === "pdf";
    }
    if (category === "images") {
      return ["jpg", "jpeg", "png"].includes(file.file_type);
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-foreground-muted mt-1">
            Manage project files for {project?.name}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-lg transition-colors">
          <Upload className="w-4 h-4" />
          Upload Files
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-hover rounded-lg">
          {[
            { key: "all", label: "All Files" },
            { key: "3d", label: "3D Models" },
            { key: "documents", label: "Documents" },
            { key: "images", label: "Images" },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key as FileCategory)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                category === cat.key
                  ? "bg-background-secondary text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & View Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary w-64"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-surface-hover rounded-lg">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "grid"
                  ? "bg-background-secondary text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "list"
                  ? "bg-background-secondary text-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Files Grid/List or Empty State */}
      {filteredFiles.length === 0 ? (
        <EmptyState />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFiles.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-hover">
              <tr>
                <th className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wide px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wide px-4 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wide px-4 py-3">
                  Size
                </th>
                <th className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wide px-4 py-3">
                  Uploaded
                </th>
                <th className="text-right text-xs font-medium text-foreground-muted uppercase tracking-wide px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredFiles.map((file) => (
                <FileRow key={file.id} file={file} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-xl">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No files uploaded
      </h3>
      <p className="text-foreground-muted text-center max-w-md mb-6">
        Upload 3D models (GLB, IFC), documents (PDF), and images (JPG, PNG) to organize
        your project files.
      </p>
      <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors">
        <Upload className="w-5 h-5" />
        Upload Your First File
      </button>
    </div>
  );
}

function FileCard({ file }: { file: ProjectFile }) {
  const FileIcon = getFileIcon(file.file_type);
  const isImage = ["jpg", "jpeg", "png"].includes(file.file_type);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden hover:border-primary/50 transition-colors group">
      {/* Preview */}
      <div className="aspect-square bg-surface-hover flex items-center justify-center relative">
        {isImage ? (
          <img
            src={file.file_url}
            alt={file.file_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <FileIcon className="w-12 h-12 text-foreground-muted" />
        )}

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-foreground truncate" title={file.file_name}>
          {file.file_name}
        </p>
        <p className="text-xs text-foreground-muted mt-0.5">
          {formatFileSize(file.file_size_bytes)}
        </p>
      </div>
    </div>
  );
}

function FileRow({ file }: { file: ProjectFile }) {
  const FileIcon = getFileIcon(file.file_type);

  return (
    <tr className="hover:bg-surface-hover transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <FileIcon className="w-5 h-5 text-foreground-muted" />
          <span className="text-sm font-medium text-foreground">{file.file_name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium uppercase text-foreground-muted px-2 py-0.5 rounded bg-surface-hover">
          {file.file_type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-foreground-muted">
        {formatFileSize(file.file_size_bytes)}
      </td>
      <td className="px-4 py-3 text-sm text-foreground-muted">
        {new Date(file.uploaded_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        <button className="p-1.5 rounded hover:bg-surface-hover transition-colors">
          <MoreVertical className="w-4 h-4 text-foreground-muted" />
        </button>
      </td>
    </tr>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getFileIcon(type: ProjectFile["file_type"]) {
  switch (type) {
    case "glb":
    case "gltf":
    case "ifc":
      return Box;
    case "pdf":
      return FileText;
    case "jpg":
    case "jpeg":
    case "png":
      return ImageIcon;
    default:
      return File;
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
