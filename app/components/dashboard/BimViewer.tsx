"use client";

import { useState, Suspense, useRef, useCallback, useTransition } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { getElementProperties, type BimElementProperties } from "@/app/actions/bim-elements";
import {
  OrbitControls,
  Grid,
  PerspectiveCamera,
  useGLTF,
  Center,
  Html,
} from "@react-three/drei";
import {
  Box,
  RefreshCw,
  Maximize2,
  Settings,
  Layers,
  Zap,
  AlertTriangle,
  Loader2,
  Search,
  X,
  Lock,
  Camera,
} from "lucide-react";
import * as THREE from "three";

// =============================================================================
// Types (Exported for external use)
// =============================================================================

export interface LayerVisibility {
  all: boolean;
  structural: boolean;
  mep: boolean;
  issues: boolean;
}

export interface BimElementData {
  id: string;
  name: string;
  type: string;
  category: "structural" | "mep" | "other" | "egress";
  position: { x: number; y: number; z: number };
  boundingBox?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  /** BIM metadata with measurements and properties for compliance analysis */
  userData?: Record<string, unknown>;
}

/** Egress element types that match Florida Building Code Chapter 10 */
export interface EgressElementData {
  elementType: "stairway" | "spiral_stairway" | "door" | "corridor" | "ramp" | "exit" | "assembly_room";
  // Stairway measurements (FBC 1011)
  stairWidth?: number; // inches
  riserHeight?: number; // inches
  treadDepth?: number; // inches
  headroom?: number; // inches
  handrailHeight?: number; // inches
  // Door measurements (FBC 1010)
  doorWidth?: number; // inches
  doorHeight?: number; // inches
  swingDirection?: "inward" | "outward";
  // Corridor measurements (FBC 1020)
  corridorWidth?: number; // inches
  // Ramp measurements (FBC 1012)
  rampSlope?: string; // e.g., "1:12"
  rampWidth?: number; // inches
  // Occupancy
  occupantLoad?: number;
  occupancyType?: string;
  floorArea?: number; // sq ft
  // General
  servesOccupants?: number;
  floorLevel?: number;
}

interface MeshMetadata {
  name: string;
  type: string;
  category: "structural" | "mep" | "other" | "egress";
  position: { x: number; y: number; z: number };
  boundingBox?: { min: THREE.Vector3; max: THREE.Vector3 };
  userData?: Record<string, unknown>;
}

interface ModelProps {
  url: string;
  layers: LayerVisibility;
  onMeshClick: (metadata: MeshMetadata) => void;
  selectedMesh: string | null;
  ghostMode?: boolean;
}

export interface CameraStateData {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface BimViewerProps {
  /** Project ID for fetching element properties from database */
  projectId?: string;
  modelUrl?: string;
  title?: string;
  pointCount?: string;
  /** Callback fired when user selects an element in the 3D model */
  onSelectElement?: (element: BimElementData) => void;
  /** Callback fired when user clicks "Run Compliance Check" button */
  onRunComplianceCheck?: (element: BimElementData) => void;
  /** Whether a compliance check is currently running */
  isCheckingCompliance?: boolean;
  /** Photo Match Mode: URL/base64 of the photo to align with */
  photoMatchImage?: string | null;
  /** Whether Photo Match Mode is active */
  photoMatchMode?: boolean;
  /** Callback when user locks the camera and is ready to analyze */
  onLockAndAnalyze?: (cameraState: CameraStateData) => void;
  /** Callback when camera state changes (for syncing with hidden renderer) */
  onCameraChange?: (cameraState: CameraStateData) => void;
}

// Highlight color for selected elements (bright cyan)
const SELECTED_COLOR = "#00ffff";
const SELECTED_COLOR_HEX = 0x00ffff;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Categorize a mesh based on its name
 */
function categorizeMesh(name: string): "structural" | "mep" | "other" | "egress" {
  const lowerName = name.toLowerCase();

  // Egress elements (Chapter 10)
  if (
    lowerName.includes("stair") ||
    lowerName.includes("exit") ||
    lowerName.includes("door") ||
    lowerName.includes("corridor") ||
    lowerName.includes("ramp") ||
    lowerName.includes("egress") ||
    lowerName.includes("assembly") ||
    lowerName.includes("handrail")
  ) {
    return "egress";
  }

  // Structural elements
  if (
    lowerName.includes("structure") ||
    lowerName.includes("wall") ||
    lowerName.includes("beam") ||
    lowerName.includes("column") ||
    lowerName.includes("slab") ||
    lowerName.includes("floor") ||
    lowerName.includes("foundation") ||
    lowerName.includes("roof")
  ) {
    return "structural";
  }

  // MEP (Mechanical, Electrical, Plumbing) elements
  if (
    lowerName.includes("pipe") ||
    lowerName.includes("duct") ||
    lowerName.includes("hvac") ||
    lowerName.includes("electrical") ||
    lowerName.includes("conduit") ||
    lowerName.includes("cable") ||
    lowerName.includes("plumbing") ||
    lowerName.includes("sprinkler") ||
    lowerName.includes("mechanical")
  ) {
    return "mep";
  }

  return "other";
}

/**
 * Check if a mesh should be visible based on current layer settings
 */
function shouldShowMesh(
  category: "structural" | "mep" | "other" | "egress",
  layers: LayerVisibility
): boolean {
  // If "All Layers" is active, show everything
  if (layers.all) return true;

  // Otherwise, check specific layer toggles
  if (category === "structural" && layers.structural) return true;
  if (category === "mep" && layers.mep) return true;
  if (category === "egress" && layers.structural) return true; // Egress shows with structural

  // "other" category meshes show if either structural or mep is active (general elements)
  if (category === "other" && (layers.structural || layers.mep)) return true;

  return false;
}

/**
 * Convert MeshMetadata to BimElementData for external use
 */
function toBimElementData(metadata: MeshMetadata): BimElementData {
  return {
    id: metadata.name,
    name: metadata.name,
    type: metadata.type,
    category: metadata.category,
    position: metadata.position,
    boundingBox: metadata.boundingBox
      ? {
          min: {
            x: metadata.boundingBox.min.x,
            y: metadata.boundingBox.min.y,
            z: metadata.boundingBox.min.z,
          },
          max: {
            x: metadata.boundingBox.max.x,
            y: metadata.boundingBox.max.y,
            z: metadata.boundingBox.max.z,
          },
        }
      : undefined,
    userData: metadata.userData,
  };
}

// =============================================================================
// Model Component - Loads and renders GLTF model
// =============================================================================

function Model({ url, layers, onMeshClick, selectedMesh, ghostMode }: ModelProps) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  // Handle mesh click
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();

      const mesh = event.object;
      if (!mesh) return;

      // Get bounding box
      const box = new THREE.Box3().setFromObject(mesh);

      const metadata: MeshMetadata = {
        name: mesh.name || "Unnamed",
        type: mesh.type,
        category: categorizeMesh(mesh.name || ""),
        position: {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        },
        boundingBox: {
          min: box.min,
          max: box.max,
        },
        userData: mesh.userData,
      };

      onMeshClick(metadata);
    },
    [onMeshClick]
  );

  // Clone and process the scene
  const processedScene = useCallback(() => {
    const clonedScene = scene.clone();

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const category = categorizeMesh(child.name || "");
        const visible = shouldShowMesh(category, layers);

        child.visible = visible;

        // Clone material to avoid mutating the original
        const material = (child.material as THREE.MeshStandardMaterial).clone();

        // Apply ghost mode - 50% opacity
        if (ghostMode) {
          material.transparent = true;
          material.opacity = 0.5;
          material.depthWrite = false;
        }

        // Apply selection highlight - bright cyan
        if (child.name === selectedMesh) {
          material.color = new THREE.Color(SELECTED_COLOR_HEX);
          material.emissive = new THREE.Color(SELECTED_COLOR_HEX);
          material.emissiveIntensity = 0.5;
        }

        child.material = material;
      }
    });

    return clonedScene;
  }, [scene, layers, selectedMesh, ghostMode]);

  return (
    <group ref={groupRef} onClick={handleClick}>
      <Center>
        <primitive object={processedScene()} scale={1} />
      </Center>
    </group>
  );
}

// =============================================================================
// Demo Egress Building Elements (lightweight - no metadata, just visuals)
// =============================================================================

/** Demo element names with display colors (metadata fetched on-demand from DB) */
const DEMO_ELEMENTS: Record<string, { color: string }> = {
  Stairway_A: { color: "#22c55e" },
  Spiral_Stairway_B: { color: "#ef4444" },
  Exit_Door_1: { color: "#22c55e" },
  Exit_Door_2: { color: "#f59e0b" },
  Corridor_A: { color: "#22c55e" },
  Corridor_B: { color: "#ef4444" },
  Ramp_Accessible: { color: "#22c55e" },
  Assembly_Room_A: { color: "#3b82f6" },
};

function PlaceholderBuilding({
  layers,
  onMeshClick,
  selectedMesh,
  ghostMode,
}: {
  layers: LayerVisibility;
  onMeshClick: (metadata: MeshMetadata) => void;
  selectedMesh: string | null;
  ghostMode?: boolean;
}) {
  // Lightweight click handler - no userData passed (fetched on-demand from DB)
  const handleMeshClick = useCallback(
    (
      name: string,
      category: "structural" | "mep" | "other" | "egress",
      position: [number, number, number]
    ) =>
      (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onMeshClick({
          name,
          type: "Mesh",
          category,
          position: { x: position[0], y: position[1], z: position[2] },
          // No userData - will be fetched on-demand from database
        });
      },
    [onMeshClick]
  );

  const getColor = (name: string, baseColor: string) => {
    return selectedMesh === name ? SELECTED_COLOR : baseColor;
  };

  const isSelected = (name: string) => selectedMesh === name;

  // Ghost mode opacity
  const ghostOpacity = ghostMode ? 0.5 : 1;

  const showStructural = layers.all || layers.structural;
  const showMEP = layers.all || layers.mep;

  return (
    <group position={[0, 0, 0]}>
      {/* Building shell */}
      {showStructural && (
        <>
          {/* Floor plate */}
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[12, 0.1, 10]} />
            <meshStandardMaterial color="#1e293b" transparent opacity={ghostOpacity} />
          </mesh>

          {/* Walls */}
          <mesh position={[-6, 1.5, 0]}>
            <boxGeometry args={[0.1, 3, 10]} />
            <meshStandardMaterial color="#334155" wireframe transparent opacity={Math.min(0.3, ghostOpacity)} />
          </mesh>
          <mesh position={[6, 1.5, 0]}>
            <boxGeometry args={[0.1, 3, 10]} />
            <meshStandardMaterial color="#334155" wireframe transparent opacity={Math.min(0.3, ghostOpacity)} />
          </mesh>
          <mesh position={[0, 1.5, -5]}>
            <boxGeometry args={[12, 3, 0.1]} />
            <meshStandardMaterial color="#334155" wireframe transparent opacity={Math.min(0.3, ghostOpacity)} />
          </mesh>
          <mesh position={[0, 1.5, 5]}>
            <boxGeometry args={[12, 3, 0.1]} />
            <meshStandardMaterial color="#334155" wireframe transparent opacity={Math.min(0.3, ghostOpacity)} />
          </mesh>
        </>
      )}

      {/* ===== EGRESS ELEMENTS (lightweight - no metadata) ===== */}
      {showStructural && (
        <>
          {/* Stairway A */}
          <mesh
            position={[-4, 1.5, -3]}
            onClick={handleMeshClick("Stairway_A", "egress", [-4, 1.5, -3])}
          >
            <boxGeometry args={[1.5, 3, 2]} />
            <meshStandardMaterial
              color={getColor("Stairway_A", DEMO_ELEMENTS.Stairway_A.color)}
              wireframe
              transparent
              opacity={ghostOpacity}
              emissive={isSelected("Stairway_A") ? SELECTED_COLOR : "#000000"}
              emissiveIntensity={isSelected("Stairway_A") ? 0.5 : 0}
            />
          </mesh>

          {/* Spiral Stairway B */}
          <mesh
            position={[4, 1.5, -3]}
            onClick={handleMeshClick("Spiral_Stairway_B", "egress", [4, 1.5, -3])}
          >
            <cylinderGeometry args={[0.8, 0.8, 3, 16]} />
            <meshStandardMaterial
              color={getColor("Spiral_Stairway_B", DEMO_ELEMENTS.Spiral_Stairway_B.color)}
              wireframe
              transparent
              opacity={ghostOpacity}
              emissive={isSelected("Spiral_Stairway_B") ? SELECTED_COLOR : "#000000"}
              emissiveIntensity={isSelected("Spiral_Stairway_B") ? 0.5 : 0}
            />
          </mesh>

          {/* Exit Door 1 */}
          <mesh
            position={[-5.9, 1, 2]}
            onClick={handleMeshClick("Exit_Door_1", "egress", [-5.9, 1, 2])}
          >
            <boxGeometry args={[0.2, 2.2, 1]} />
            <meshStandardMaterial
              color={getColor("Exit_Door_1", DEMO_ELEMENTS.Exit_Door_1.color)}
              transparent
              opacity={ghostOpacity}
              emissive={isSelected("Exit_Door_1") ? SELECTED_COLOR : "#000000"}
              emissiveIntensity={isSelected("Exit_Door_1") ? 0.5 : 0}
            />
          </mesh>

          {/* Exit Door 2 */}
          <mesh
            position={[5.9, 1, 2]}
            onClick={handleMeshClick("Exit_Door_2", "egress", [5.9, 1, 2])}
          >
            <boxGeometry args={[0.2, 2.1, 0.9]} />
            <meshStandardMaterial
              color={getColor("Exit_Door_2", DEMO_ELEMENTS.Exit_Door_2.color)}
              transparent
              opacity={ghostOpacity}
              emissive={isSelected("Exit_Door_2") ? SELECTED_COLOR : "#000000"}
              emissiveIntensity={isSelected("Exit_Door_2") ? 0.5 : 0}
            />
          </mesh>

          {/* Corridor A */}
          <mesh
            position={[0, 0.1, 0]}
            onClick={handleMeshClick("Corridor_A", "egress", [0, 0.1, 0])}
          >
            <boxGeometry args={[8, 0.05, 1.5]} />
            <meshStandardMaterial
              color={getColor("Corridor_A", DEMO_ELEMENTS.Corridor_A.color)}
              transparent
              opacity={Math.min(0.7, ghostOpacity)}
              emissive={isSelected("Corridor_A") ? SELECTED_COLOR : "#000000"}
              emissiveIntensity={isSelected("Corridor_A") ? 0.3 : 0}
            />
          </mesh>

          {/* Corridor B */}
          <mesh
            position={[0, 0.1, 3]}
            onClick={handleMeshClick("Corridor_B", "egress", [0, 0.1, 3])}
          >
            <boxGeometry args={[6, 0.05, 1]} />
            <meshStandardMaterial
              color={getColor("Corridor_B", DEMO_ELEMENTS.Corridor_B.color)}
              transparent
              opacity={Math.min(0.7, ghostOpacity)}
              emissive={isSelected("Corridor_B") ? SELECTED_COLOR : "#000000"}
              emissiveIntensity={isSelected("Corridor_B") ? 0.3 : 0}
            />
          </mesh>

          {/* Accessible Ramp */}
          <mesh
            position={[-5.5, 0.3, -1]}
            rotation={[0, 0, -0.1]}
            onClick={handleMeshClick("Ramp_Accessible", "egress", [-5.5, 0.3, -1])}
          >
            <boxGeometry args={[2, 0.1, 1.2]} />
            <meshStandardMaterial
              color={getColor("Ramp_Accessible", DEMO_ELEMENTS.Ramp_Accessible.color)}
              transparent
              opacity={ghostOpacity}
              emissive={isSelected("Ramp_Accessible") ? SELECTED_COLOR : "#000000"}
              emissiveIntensity={isSelected("Ramp_Accessible") ? 0.3 : 0}
            />
          </mesh>

          {/* Assembly Room A */}
          <mesh
            position={[2, 0.05, -2]}
            onClick={handleMeshClick("Assembly_Room_A", "egress", [2, 0.05, -2])}
          >
            <boxGeometry args={[4, 0.02, 3]} />
            <meshStandardMaterial
              color={getColor("Assembly_Room_A", DEMO_ELEMENTS.Assembly_Room_A.color)}
              transparent
              opacity={Math.min(0.5, ghostOpacity)}
              emissive={isSelected("Assembly_Room_A") ? SELECTED_COLOR : "#000000"}
              emissiveIntensity={isSelected("Assembly_Room_A") ? 0.3 : 0}
            />
          </mesh>
        </>
      )}

      {/* MEP Systems */}
      {showMEP && (
        <>
          <mesh position={[0, 2.8, 0]}>
            <boxGeometry args={[10, 0.3, 0.3]} />
            <meshStandardMaterial color="#22c55e" wireframe transparent opacity={ghostOpacity} />
          </mesh>
          <mesh position={[0, 2.8, 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 10, 8]} />
            <meshStandardMaterial color="#06b6d4" wireframe transparent opacity={ghostOpacity} />
          </mesh>
        </>
      )}
    </group>
  );
}

// =============================================================================
// Loading Fallback
// =============================================================================

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 rounded-lg border border-slate-700">
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        <span className="text-slate-300 text-sm">Loading model...</span>
      </div>
    </Html>
  );
}

// =============================================================================
// Camera Controller - Tracks camera movement
// =============================================================================

import { useFrame, useThree } from "@react-three/fiber";

function CameraController({ onCameraChange }: { onCameraChange?: (state: CameraStateData) => void }) {
  const { camera, controls } = useThree();
  const lastCameraState = useRef<string>("");

  useFrame(() => {
    if (!onCameraChange) return;

    // Get current camera state
    const position = camera.position;
    const rotation = camera.rotation;

    // Get target from OrbitControls if available
    let target = { x: 0, y: 0, z: 0 };
    if (controls && "target" in controls) {
      const orbitTarget = (controls as { target: THREE.Vector3 }).target;
      target = { x: orbitTarget.x, y: orbitTarget.y, z: orbitTarget.z };
    }

    const currentState = JSON.stringify({
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
      target,
    });

    // Only callback if state changed
    if (currentState !== lastCameraState.current) {
      lastCameraState.current = currentState;
      onCameraChange({
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
        target,
      });
    }
  });

  return null;
}

// =============================================================================
// Photo Background Component (HTML-based for Photo Match Mode)
// =============================================================================

interface PhotoBackgroundProps {
  imageUrl: string;
}

function PhotoBackground({ imageUrl }: PhotoBackgroundProps) {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#0f172a",
      }}
    />
  );
}

// =============================================================================
// Scene Component
// =============================================================================

interface SceneProps {
  modelUrl?: string;
  layers: LayerVisibility;
  onMeshClick: (metadata: MeshMetadata) => void;
  selectedMesh: string | null;
  ghostMode?: boolean;
  onCameraChange?: (cameraState: CameraStateData) => void;
}

function Scene({ modelUrl, layers, onMeshClick, selectedMesh, ghostMode, onCameraChange }: SceneProps) {
  return (
    <>
      {/* Camera with change tracking */}
      <CameraController onCameraChange={onCameraChange} />
      <PerspectiveCamera makeDefault position={[8, 6, 8]} fov={50} />

      {/* Lighting - adjust for ghost mode */}
      <ambientLight intensity={ghostMode ? 0.6 : 0.4} />
      <directionalLight position={[10, 10, 5]} intensity={ghostMode ? 1.0 : 0.8} />
      <pointLight position={[-10, -10, -5]} intensity={0.3} color="#3b82f6" />

      {/* Grid floor - hide in ghost/photo match mode */}
      {!ghostMode && (
        <Grid
          args={[50, 50]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#334155"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#475569"
          fadeDistance={50}
          fadeStrength={1}
          followCamera={false}
          position={[0, 0, 0]}
        />
      )}

      {/* Model or Placeholder */}
      <Suspense fallback={<LoadingFallback />}>
        {modelUrl ? (
          <Model
            url={modelUrl}
            layers={layers}
            onMeshClick={onMeshClick}
            selectedMesh={selectedMesh}
            ghostMode={ghostMode}
          />
        ) : (
          <PlaceholderBuilding
            layers={layers}
            onMeshClick={onMeshClick}
            selectedMesh={selectedMesh}
            ghostMode={ghostMode}
          />
        )}
      </Suspense>

      {/* Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

// =============================================================================
// Layer Button Component
// =============================================================================

interface LayerButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function LayerButton({ icon, label, active, onClick }: LayerButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
        active
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// =============================================================================
// Element Details Panel (On-Demand Fetching from Database)
// =============================================================================

interface ElementDetailsPanelProps {
  element: BimElementData | null;
  fetchedProperties: BimElementProperties | null;
  isLoadingProperties: boolean;
  fetchError: string | null;
  onClose: () => void;
  onRunComplianceCheck: () => void;
  isCheckingCompliance: boolean;
}

function ElementDetailsPanel({
  element,
  fetchedProperties,
  isLoadingProperties,
  fetchError,
  onClose,
  onRunComplianceCheck,
  isCheckingCompliance,
}: ElementDetailsPanelProps) {
  if (!element) return null;

  const categoryColors: Record<string, string> = {
    structural: "text-blue-400 bg-blue-400/10",
    mep: "text-green-400 bg-green-400/10",
    egress: "text-amber-400 bg-amber-400/10",
    other: "text-slate-400 bg-slate-400/10",
  };

  const categoryLabels: Record<string, string> = {
    structural: "Structural",
    mep: "MEP",
    egress: "Egress (Ch.10)",
    other: "General",
  };

  // Format dimension value with unit
  const formatDimension = (value: number | null, unit: string = ""): string => {
    if (value === null || value === undefined) return "-";
    return `${value}${unit}`;
  };

  // Get key dimensions from fetched properties
  const getDimensions = () => {
    if (!fetchedProperties) return [];
    const dims: { label: string; value: string }[] = [];

    if (fetchedProperties.height !== null) dims.push({ label: "Height", value: formatDimension(fetchedProperties.height, '"') });
    if (fetchedProperties.width !== null) dims.push({ label: "Width", value: formatDimension(fetchedProperties.width, '"') });
    if (fetchedProperties.length !== null) dims.push({ label: "Length", value: formatDimension(fetchedProperties.length, '"') });
    if (fetchedProperties.area !== null) dims.push({ label: "Area", value: formatDimension(fetchedProperties.area, ' sq ft') });
    if (fetchedProperties.volume !== null) dims.push({ label: "Volume", value: formatDimension(fetchedProperties.volume, ' cu ft') });

    return dims;
  };

  // Get IFC properties from the properties JSONB field
  const getIfcProperties = () => {
    if (!fetchedProperties?.properties) return [];
    const props = fetchedProperties.properties as Record<string, unknown>;
    const entries: { key: string; value: string }[] = [];

    // Flatten first level of properties
    for (const [psetName, psetValue] of Object.entries(props)) {
      if (typeof psetValue === 'object' && psetValue !== null) {
        for (const [propName, propValue] of Object.entries(psetValue as Record<string, unknown>)) {
          entries.push({
            key: `${psetName}.${propName}`,
            value: String(propValue),
          });
        }
      } else {
        entries.push({
          key: psetName,
          value: String(psetValue),
        });
      }
    }

    return entries.slice(0, 12); // Limit to 12 properties
  };

  const dimensions = getDimensions();
  const ifcProps = getIfcProperties();

  return (
    <div className="absolute top-16 right-4 bottom-16 z-10 w-80 flex flex-col animate-in slide-in-from-right-2 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-500/10 flex flex-col max-h-full overflow-hidden">
        {/* Header with cyan accent - fixed */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-gradient-to-r from-cyan-500/10 to-transparent border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLoadingProperties ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400'}`} />
            <span className="text-white font-semibold text-xs">Element Details</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {/* Element ID & Category Row */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-cyan-400 font-mono text-xs bg-cyan-400/5 px-2 py-0.5 rounded truncate flex-1">
              {element.id}
            </p>
            <span
              className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${categoryColors[element.category] || categoryColors.other}`}
            >
              {categoryLabels[element.category] || element.category}
            </span>
          </div>

          {/* Loading State */}
          {isLoadingProperties && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mr-2" />
              <span className="text-slate-400 text-xs">Fetching properties...</span>
            </div>
          )}

          {/* Error State */}
          {fetchError && !isLoadingProperties && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <p className="text-red-400 text-xs">{fetchError}</p>
              <p className="text-slate-500 text-[10px] mt-1">Element may not exist in database yet.</p>
            </div>
          )}

          {/* Fetched Properties */}
          {fetchedProperties && !isLoadingProperties && (
            <>
              {/* Name & Type */}
              <div>
                {fetchedProperties.name && (
                  <p className="text-white font-medium text-sm">{fetchedProperties.name}</p>
                )}
                {fetchedProperties.typeName && (
                  <p className="text-slate-400 text-xs">{fetchedProperties.typeName}</p>
                )}
              </div>

              {/* IFC Category & Level */}
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300">
                  {fetchedProperties.category}
                </span>
                {fetchedProperties.level && (
                  <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300">
                    {fetchedProperties.level}
                  </span>
                )}
              </div>

              {/* Classification Codes */}
              {(fetchedProperties.masterformatCode || fetchedProperties.uniformatCode || fetchedProperties.omniclassCode) && (
                <div className="pt-1">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                    Classification
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {fetchedProperties.masterformatCode && (
                      <div className="text-[11px]">
                        <span className="text-slate-500">MasterFormat:</span>
                        <span className="text-white ml-1 font-mono">{fetchedProperties.masterformatCode}</span>
                      </div>
                    )}
                    {fetchedProperties.uniformatCode && (
                      <div className="text-[11px]">
                        <span className="text-slate-500">UniFormat:</span>
                        <span className="text-white ml-1 font-mono">{fetchedProperties.uniformatCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dimensions */}
              {dimensions.length > 0 && (
                <div className="pt-1">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                    Dimensions
                  </span>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {dimensions.map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex justify-between items-center text-[11px] bg-slate-800/50 rounded px-1.5 py-1"
                      >
                        <span className="text-slate-400">{label}</span>
                        <span className="text-white font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* IFC Properties */}
              {ifcProps.length > 0 && (
                <div className="pt-1">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                    IFC Properties
                  </span>
                  <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                    {ifcProps.map(({ key, value }) => (
                      <div
                        key={key}
                        className="text-[10px] bg-slate-800/30 rounded px-1.5 py-1 flex justify-between"
                      >
                        <span className="text-slate-500 truncate mr-2">{key}</span>
                        <span className="text-slate-300 font-mono truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System Info (for MEP) */}
              {fetchedProperties.systemName && (
                <div className="pt-1">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                    System
                  </span>
                  <div className="mt-1 text-xs">
                    <span className="text-white">{fetchedProperties.systemName}</span>
                    {fetchedProperties.systemType && (
                      <span className="text-slate-500 ml-1">({fetchedProperties.systemType})</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Run Compliance Check Button - fixed at bottom */}
        <div className="flex-shrink-0 p-3 border-t border-slate-700/50 bg-slate-900/50">
          <button
            onClick={onRunComplianceCheck}
            disabled={isCheckingCompliance || isLoadingProperties}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
              isCheckingCompliance || isLoadingProperties
                ? "bg-cyan-500/20 text-cyan-300 cursor-wait"
                : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/25"
            }`}
          >
            {isCheckingCompliance ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-3 h-3" />
                Run Compliance Check
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main BimViewer Component
// =============================================================================

export default function BimViewer({
  projectId,
  modelUrl,
  title = "Metro Station Hub",
  pointCount = "2.4M points",
  onSelectElement,
  onRunComplianceCheck,
  isCheckingCompliance = false,
  photoMatchImage,
  photoMatchMode = false,
  onLockAndAnalyze,
  onCameraChange,
}: BimViewerProps) {
  // Layer visibility state
  const [layers, setLayers] = useState<LayerVisibility>({
    all: true,
    structural: false,
    mep: false,
    issues: false,
  });

  // Selected element state
  const [selectedMesh, setSelectedMesh] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<BimElementData | null>(null);

  // On-demand fetching state
  const [fetchedProperties, setFetchedProperties] = useState<BimElementProperties | null>(null);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Camera state for Photo Match Mode
  const cameraStateRef = useRef<CameraStateData>({
    position: { x: 8, y: 6, z: 8 },
    rotation: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
  });

  const toggleLayer = (layer: keyof LayerVisibility) => {
    if (layer === "all") {
      setLayers({ all: true, structural: false, mep: false, issues: false });
    } else {
      setLayers((prev) => ({
        ...prev,
        all: false,
        [layer]: !prev[layer],
      }));
    }
  };

  // Fetch element properties from database on-demand
  const fetchElementProperties = useCallback(
    async (elementName: string) => {
      if (!projectId) {
        console.log("[BimViewer] No projectId provided - skipping DB fetch");
        return;
      }

      setIsLoadingProperties(true);
      setFetchError(null);
      setFetchedProperties(null);

      try {
        // Try to fetch by globalId first (element name might be the globalId)
        const result = await getElementProperties(projectId, elementName);

        if (result.success && result.element) {
          console.log("[BimViewer] Fetched properties from DB:", result.element);
          setFetchedProperties(result.element);
        } else {
          // Element not found in database
          setFetchError(result.error || "Element not found in database");
          console.log("[BimViewer] Element not in DB:", result.error);
        }
      } catch (error) {
        console.error("[BimViewer] Error fetching properties:", error);
        setFetchError(error instanceof Error ? error.message : "Failed to fetch properties");
      } finally {
        setIsLoadingProperties(false);
      }
    },
    [projectId]
  );

  const handleMeshClick = useCallback(
    (metadata: MeshMetadata) => {
      console.log("=== BIM ELEMENT SELECTED ===");
      console.log("ID:", metadata.name);
      console.log("Category:", metadata.category);
      console.log("Position:", metadata.position);
      console.log("============================");

      // Update internal state
      setSelectedMesh(metadata.name);
      const elementData = toBimElementData(metadata);
      setSelectedElement(elementData);

      // Fetch properties from database on-demand
      startTransition(() => {
        fetchElementProperties(metadata.name);
      });

      // Call external callback if provided
      if (onSelectElement) {
        onSelectElement(elementData);
      }
    },
    [onSelectElement, fetchElementProperties]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedMesh(null);
    setSelectedElement(null);
    setFetchedProperties(null);
    setFetchError(null);
  }, []);

  const handleRunComplianceCheck = useCallback(() => {
    if (selectedElement && onRunComplianceCheck) {
      onRunComplianceCheck(selectedElement);
    }
  }, [selectedElement, onRunComplianceCheck]);

  // Handle camera state changes from the 3D scene
  const handleCameraChange = useCallback(
    (state: CameraStateData) => {
      cameraStateRef.current = state;
      if (onCameraChange) {
        onCameraChange(state);
      }
    },
    [onCameraChange]
  );

  // Handle Lock & Analyze button click
  const handleLockAndAnalyze = useCallback(() => {
    if (onLockAndAnalyze) {
      onLockAndAnalyze(cameraStateRef.current);
    }
  }, [onLockAndAnalyze]);

  return (
    <div className="relative w-full h-[600px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        {/* Title */}
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700/50">
          <Box className="w-5 h-5 text-blue-400" />
          <span className="text-white font-semibold">{title}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700/50">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Element Details Panel - hide in photo match mode */}
      {!photoMatchMode && (
        <ElementDetailsPanel
          element={selectedElement}
          fetchedProperties={fetchedProperties}
          isLoadingProperties={isLoadingProperties || isPending}
          fetchError={fetchError}
          onClose={handleClosePanel}
          onRunComplianceCheck={handleRunComplianceCheck}
          isCheckingCompliance={isCheckingCompliance}
        />
      )}

      {/* Photo Background for Photo Match Mode */}
      {photoMatchMode && photoMatchImage && (
        <PhotoBackground imageUrl={photoMatchImage} />
      )}

      {/* 3D Canvas - transparent background in photo match mode */}
      <Canvas
        className="w-full h-full"
        style={{ position: "relative", zIndex: 1 }}
        gl={{ alpha: photoMatchMode, preserveDrawingBuffer: true }}
      >
        {/* Hide grid in photo match mode */}
        <Scene
          modelUrl={modelUrl}
          layers={layers}
          onMeshClick={handleMeshClick}
          selectedMesh={selectedMesh}
          ghostMode={photoMatchMode}
          onCameraChange={handleCameraChange}
        />
      </Canvas>

      {/* Photo Match Mode Overlay UI */}
      {photoMatchMode && (
        <div className="absolute top-16 left-4 z-20">
          <div className="px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-lg border border-amber-500/50">
            <div className="flex items-center gap-2 text-amber-200">
              <Camera className="w-4 h-4" />
              <span className="text-sm font-medium">Photo Match Mode</span>
            </div>
            <p className="text-xs text-amber-200/70 mt-1">
              Rotate/zoom the 3D model to align with the photo
            </p>
          </div>
        </div>
      )}

      {/* Lock & Analyze Button for Photo Match Mode */}
      {photoMatchMode && onLockAndAnalyze && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={handleLockAndAnalyze}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-orange-400 transition-all duration-200 transform hover:scale-105"
          >
            <Lock className="w-5 h-5" />
            Lock & Analyze
          </button>
        </div>
      )}

      {/* Bottom Controls Dock - hide in photo match mode */}
      {!photoMatchMode && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="flex items-center gap-1 px-2 py-2 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <LayerButton
              icon={<Layers className="w-4 h-4" />}
              label="All Layers"
              active={layers.all}
              onClick={() => toggleLayer("all")}
            />
            <LayerButton
              icon={<Box className="w-4 h-4" />}
              label="Structural"
              active={layers.structural}
              onClick={() => toggleLayer("structural")}
            />
            <LayerButton
              icon={<Zap className="w-4 h-4" />}
              label="MEP"
              active={layers.mep}
              onClick={() => toggleLayer("mep")}
            />
            <LayerButton
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Issues"
              active={layers.issues}
              onClick={() => toggleLayer("issues")}
            />
          </div>
        </div>
      )}

      {/* Status Indicator - hide in photo match mode */}
      {!photoMatchMode && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700/50">
            {/* Pulsing green dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-sm text-slate-300">
              Live Sync <span className="text-slate-500">|</span>{" "}
              <span className="text-slate-400">{pointCount}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
