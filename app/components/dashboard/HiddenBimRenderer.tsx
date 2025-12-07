"use client";

import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// =============================================================================
// Types
// =============================================================================

export interface CameraState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  target?: { x: number; y: number; z: number };
}

export interface ColorToIdEntry {
  meshName: string;
  meshId: string;
  color: string;
  userData?: Record<string, unknown>;
}

export type ColorToIdMap = Map<string, ColorToIdEntry>;

export interface HiddenBimRendererRef {
  /** Capture the current ID map render as a base64 Data URL */
  captureSnapshot: () => string | null;
  /** Get the color-to-ID dictionary */
  getColorToIdMap: () => Record<string, ColorToIdEntry>;
  /** Update camera position/rotation to match main viewer */
  updateCamera: (cameraState: CameraState) => void;
  /** Check if the model is loaded and ready */
  isReady: () => boolean;
}

export interface HiddenBimRendererProps {
  /** URL to the GLB/GLTF model file */
  modelUrl?: string;
  /** Initial camera state */
  initialCamera?: CameraState;
  /** Canvas resolution width (default: 1024) */
  width?: number;
  /** Canvas resolution height (default: 768) */
  height?: number;
  /** Callback when model is loaded and color map is ready */
  onReady?: (colorMap: Record<string, ColorToIdEntry>) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

// =============================================================================
// Color Generation Utilities
// =============================================================================

/**
 * Generates a unique color for each mesh index.
 * Uses a deterministic algorithm to ensure consistent colors across renders.
 * Avoids colors too close to black (background) or white.
 */
function generateUniqueColor(index: number): string {
  // Use golden ratio to distribute colors evenly across the spectrum
  const goldenRatio = 0.618033988749895;
  const hue = (index * goldenRatio) % 1;

  // Keep saturation and lightness in ranges that are distinct
  const saturation = 0.7 + (index % 3) * 0.1; // 0.7-0.9
  const lightness = 0.4 + (index % 5) * 0.08; // 0.4-0.72

  // Convert HSL to RGB
  const { r, g, b } = hslToRgb(hue, saturation, lightness);

  // Convert to hex
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r, g, b };
}

/**
 * Parse hex color to THREE.Color
 */
function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// =============================================================================
// Hidden BIM Renderer Component
// =============================================================================

const HiddenBimRenderer = forwardRef<HiddenBimRendererRef, HiddenBimRendererProps>(
  function HiddenBimRenderer(
    {
      modelUrl,
      initialCamera,
      width = 1024,
      height = 768,
      onReady,
      onError,
    },
    ref
  ) {
    // Refs for Three.js objects
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const colorMapRef = useRef<ColorToIdMap>(new Map());
    const isReadyRef = useRef(false);
    const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());

    // State for tracking load status
    const [, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

    // Initialize Three.js scene
    const initializeScene = useCallback(() => {
      if (!containerRef.current) return;

      // Create renderer with off-screen canvas
      const renderer = new THREE.WebGLRenderer({
        antialias: false, // Disable for cleaner color boundaries
        preserveDrawingBuffer: true, // Required for snapshot
        alpha: false,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1); // Use 1:1 pixel ratio for accurate color picking
      renderer.setClearColor(0x000000, 1); // Black background
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // Prevent color space conversion

      // Append canvas to hidden container
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      if (initialCamera) {
        camera.position.set(
          initialCamera.position.x,
          initialCamera.position.y,
          initialCamera.position.z
        );
        if (initialCamera.target) {
          camera.lookAt(
            initialCamera.target.x,
            initialCamera.target.y,
            initialCamera.target.z
          );
        }
      } else {
        camera.position.set(15, 12, 15);
        camera.lookAt(0, 0, 0);
      }
      cameraRef.current = camera;

      // Add ambient light (flat lighting for ID map)
      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      scene.add(ambientLight);
    }, [width, height, initialCamera]);

    // Load and process GLB model
    const loadModel = useCallback(
      async (url: string) => {
        if (!sceneRef.current) return;

        setLoadStatus("loading");
        const loader = new GLTFLoader();

        try {
          const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
          });

          const model = gltf.scene;
          let meshIndex = 0;
          const colorMap = new Map<string, ColorToIdEntry>();

          // Traverse all meshes and apply unique colors
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              // Store original material for potential restoration
              originalMaterialsRef.current.set(child, child.material);

              // Generate unique color for this mesh
              const uniqueColor = generateUniqueColor(meshIndex);
              const threeColor = hexToThreeColor(uniqueColor);

              // Create flat, unlit material with the unique color
              const idMaterial = new THREE.MeshBasicMaterial({
                color: threeColor,
                side: THREE.DoubleSide,
                fog: false,
                toneMapped: false, // Prevent tone mapping from altering colors
              });

              // Apply the ID material
              child.material = idMaterial;

              // Build color-to-ID mapping
              const entry: ColorToIdEntry = {
                meshName: child.name || `Mesh_${meshIndex}`,
                meshId: child.uuid,
                color: uniqueColor,
                userData: child.userData as Record<string, unknown>,
              };
              colorMap.set(uniqueColor, entry);

              meshIndex++;
            }
          });

          // Add model to scene
          sceneRef.current.add(model);
          colorMapRef.current = colorMap;

          // Render once to ensure everything is ready
          if (rendererRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }

          isReadyRef.current = true;
          setLoadStatus("ready");

          // Notify parent component
          if (onReady) {
            onReady(Object.fromEntries(colorMap));
          }

          console.log(`[HiddenBimRenderer] Loaded model with ${meshIndex} meshes`);
        } catch (error) {
          console.error("[HiddenBimRenderer] Failed to load model:", error);
          setLoadStatus("error");
          if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)));
          }
        }
      },
      [onReady, onError]
    );

    // Load built-in egress model (same as BimViewer)
    const loadBuiltInModel = useCallback(() => {
      if (!sceneRef.current) return;

      setLoadStatus("loading");

      // Import egress elements from BimViewer's built-in model
      const EGRESS_ELEMENTS: Record<string, {
        name: string;
        category: string;
        color: string;
        position: [number, number, number];
        size: [number, number, number];
        userData: Record<string, unknown>;
      }> = {
        Stairway_A: {
          name: "Stairway_A",
          category: "egress",
          color: "#22c55e",
          position: [-6, 1.5, 0],
          size: [3, 3, 4],
          userData: {
            elementType: "stairway",
            stairWidth: 44,
            riserHeight: 7,
            treadDepth: 11,
            headroom: 84,
            handrailHeight: 36,
            servesOccupants: 150,
            floorLevel: 1,
            description: "Main egress stairway - Compliant with FBC 1011",
          },
        },
        Spiral_Stairway_B: {
          name: "Spiral_Stairway_B",
          category: "egress",
          color: "#ef4444",
          position: [6, 1.5, -4],
          size: [2.5, 3, 2.5],
          userData: {
            elementType: "spiral_stairway",
            stairWidth: 26,
            riserHeight: 9.5,
            treadDepth: 6.5,
            headroom: 78,
            handrailHeight: 34,
            servesOccupants: 5,
            floorLevel: 1,
            description: "Secondary spiral stairway - NON-COMPLIANT (tread depth < 6.75 in, headroom < 80 in)",
          },
        },
        Exit_Door_1: {
          name: "Exit_Door_1",
          category: "egress",
          color: "#22c55e",
          position: [-3, 1.5, 6],
          size: [1.5, 3, 0.3],
          userData: {
            elementType: "door",
            doorWidth: 36,
            doorHeight: 84,
            swingDirection: "outward",
            servesOccupants: 50,
            floorLevel: 1,
            description: "Main exit door - Compliant with FBC 1010",
          },
        },
        Exit_Door_2: {
          name: "Exit_Door_2",
          category: "egress",
          color: "#ef4444",
          position: [3, 1.5, 6],
          size: [1.2, 3, 0.3],
          userData: {
            elementType: "door",
            doorWidth: 32,
            doorHeight: 80,
            swingDirection: "inward",
            servesOccupants: 60,
            floorLevel: 1,
            description: "Secondary exit - NON-COMPLIANT (swings inward for >50 occupants)",
          },
        },
        Corridor_A: {
          name: "Corridor_A",
          category: "egress",
          color: "#22c55e",
          position: [0, 0.1, 3],
          size: [8, 0.2, 2],
          userData: {
            elementType: "corridor",
            corridorWidth: 48,
            servesOccupants: 100,
            floorLevel: 1,
            description: "Main corridor - Compliant with FBC 1020 (>44 in width)",
          },
        },
        Corridor_B: {
          name: "Corridor_B",
          category: "egress",
          color: "#f59e0b",
          position: [0, 0.1, -3],
          size: [6, 0.2, 1.5],
          userData: {
            elementType: "corridor",
            corridorWidth: 36,
            servesOccupants: 80,
            floorLevel: 1,
            description: "Secondary corridor - NON-COMPLIANT (width < 44 in minimum)",
          },
        },
        Ramp_Accessible: {
          name: "Ramp_Accessible",
          category: "egress",
          color: "#22c55e",
          position: [6, 0.75, 4],
          size: [2, 1.5, 6],
          userData: {
            elementType: "ramp",
            rampSlope: "1:12",
            rampWidth: 44,
            handrailHeight: 36,
            servesOccupants: 50,
            description: "Accessible ramp - Compliant with FBC 1012",
          },
        },
        Assembly_Room_A: {
          name: "Assembly_Room_A",
          category: "egress",
          color: "#3b82f6",
          position: [0, 0.05, 0],
          size: [10, 0.1, 8],
          userData: {
            elementType: "assembly_room",
            floorArea: 500,
            occupantLoad: 50,
            occupancyType: "Assembly - Standing",
            description: "Main assembly area - Check occupant load against Table 1004.5",
          },
        },
      };

      const colorMap = new Map<string, ColorToIdEntry>();
      let meshIndex = 0;

      // Create meshes for each egress element
      Object.entries(EGRESS_ELEMENTS).forEach(([key, element]) => {
        const geometry = new THREE.BoxGeometry(...element.size);

        // Generate unique ID color (not the visual color)
        const uniqueColor = generateUniqueColor(meshIndex);
        const threeColor = hexToThreeColor(uniqueColor);

        const material = new THREE.MeshBasicMaterial({
          color: threeColor,
          side: THREE.DoubleSide,
          fog: false,
          toneMapped: false,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = element.name;
        mesh.position.set(...element.position);
        mesh.userData = element.userData;

        sceneRef.current!.add(mesh);

        // Build color-to-ID mapping
        const entry: ColorToIdEntry = {
          meshName: element.name,
          meshId: mesh.uuid,
          color: uniqueColor,
          userData: element.userData,
        };
        colorMap.set(uniqueColor, entry);

        meshIndex++;
      });

      // Add floor plane
      const floorGeometry = new THREE.PlaneGeometry(30, 30);
      const floorColor = generateUniqueColor(meshIndex);
      const floorMaterial = new THREE.MeshBasicMaterial({
        color: hexToThreeColor(floorColor),
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.name = "Floor_Ground";
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.01;
      sceneRef.current!.add(floor);

      colorMap.set(floorColor, {
        meshName: "Floor_Ground",
        meshId: floor.uuid,
        color: floorColor,
        userData: { elementType: "floor", description: "Ground floor" },
      });

      colorMapRef.current = colorMap;

      // Render once
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current!, cameraRef.current);
      }

      isReadyRef.current = true;
      setLoadStatus("ready");

      if (onReady) {
        onReady(Object.fromEntries(colorMap));
      }

      console.log(`[HiddenBimRenderer] Created ${meshIndex + 1} meshes for ID map`);
    }, [onReady]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        captureSnapshot: (): string | null => {
          if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
            console.warn("[HiddenBimRenderer] Cannot capture: renderer not ready");
            return null;
          }

          // Ensure we have the latest render
          rendererRef.current.render(sceneRef.current, cameraRef.current);

          // Get canvas data as base64
          const canvas = rendererRef.current.domElement;
          const dataUrl = canvas.toDataURL("image/png");

          console.log(`[HiddenBimRenderer] Captured snapshot: ${width}x${height}`);
          return dataUrl;
        },

        getColorToIdMap: (): Record<string, ColorToIdEntry> => {
          return Object.fromEntries(colorMapRef.current);
        },

        updateCamera: (cameraState: CameraState): void => {
          if (!cameraRef.current) return;

          cameraRef.current.position.set(
            cameraState.position.x,
            cameraState.position.y,
            cameraState.position.z
          );

          if (cameraState.target) {
            cameraRef.current.lookAt(
              cameraState.target.x,
              cameraState.target.y,
              cameraState.target.z
            );
          } else if (cameraState.rotation) {
            cameraRef.current.rotation.set(
              cameraState.rotation.x,
              cameraState.rotation.y,
              cameraState.rotation.z
            );
          }

          // Re-render with updated camera
          if (rendererRef.current && sceneRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        },

        isReady: (): boolean => {
          return isReadyRef.current;
        },
      }),
      [width, height]
    );

    // Initialize on mount
    useEffect(() => {
      initializeScene();

      return () => {
        // Cleanup
        if (rendererRef.current) {
          rendererRef.current.dispose();
          if (containerRef.current && rendererRef.current.domElement) {
            containerRef.current.removeChild(rendererRef.current.domElement);
          }
        }
        if (sceneRef.current) {
          sceneRef.current.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              if (Array.isArray(object.material)) {
                object.material.forEach((m) => m.dispose());
              } else {
                object.material.dispose();
              }
            }
          });
        }
        originalMaterialsRef.current.clear();
        colorMapRef.current.clear();
        isReadyRef.current = false;
      };
    }, [initializeScene]);

    // Load model when URL changes or use built-in
    useEffect(() => {
      if (!sceneRef.current) return;

      if (modelUrl) {
        loadModel(modelUrl);
      } else {
        // Use built-in egress model
        loadBuiltInModel();
      }
    }, [modelUrl, loadModel, loadBuiltInModel]);

    // Hidden container - positioned off-screen
    return (
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: `${width}px`,
          height: `${height}px`,
          overflow: "hidden",
          pointerEvents: "none",
          visibility: "hidden",
        }}
        aria-hidden="true"
      />
    );
  }
);

export default HiddenBimRenderer;
