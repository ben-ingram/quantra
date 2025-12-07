import trimesh
import numpy as np
import math

def create_spiral_staircase():
    # Stair Parameters (matching the "Target Design" in the Specs)
    num_steps = 12
    riser_height = 9.0  # inches (0.75 feet) - converted to generic units
    radius = 30.0       # inches
    pole_radius = 4.0   # inches
    
    meshes = []
    
    # 1. Create the Center Pole
    pole_height = num_steps * riser_height + 20 # Extra height for railing
    pole = trimesh.creation.cylinder(radius=pole_radius, height=pole_height)
    pole.visual.face_colors = [100, 100, 100, 255] # Dark Grey
    pole.metadata = {
        "name": "Center_Pole_01", 
        "category": "Structure",
        "guid": "c092-pole-001"
    }
    meshes.append(pole)
    
    # 2. Create Steps
    for i in range(num_steps):
        # Create a wedge shape for the tread
        # Simple approximation using a box, rotated
        step_thickness = 2.0
        step_width = radius - pole_radius
        step_depth = 12.0 # Average depth
        
        step = trimesh.creation.box(extents=[step_width, step_thickness, step_depth])
        
        # Position the step
        # Move out to radius
        step.apply_translation([pole_radius + (step_width/2), 0, 0])
        
        # Rotate around Z axis (spiral)
        angle = i * (360 / num_steps) * (math.pi / 180) * 0.5 # Partial turn
        rotation = trimesh.transformations.rotation_matrix(angle, [0, 0, 1])
        step.apply_transform(rotation)
        
        # Move up (riser height)
        z_pos = (i * riser_height) - (pole_height/2) + riser_height
        step.apply_translation([0, 0, z_pos])
        
        # Color & Metadata (CRITICAL for your Visual RAG)
        step.visual.face_colors = [200, 50, 50, 255] # Reddish
        step.metadata = {
            "name": f"Tread_{i+1:02d}",
            "category": "Stair_Tread",
            "properties": {
                "Material": "Steel",
                "DesignedRiser": 9.0,
                "SpecSection": "05 51 00"
            }
        }
        
        meshes.append(step)

    # Combine into a scene
    scene = trimesh.Scene(meshes)
    
    # Export to GLB
    scene.export("spiral_stair_test.glb")
    print("Successfully created 'spiral_stair_test.glb' with embedded metadata.")

if __name__ == "__main__":
    create_spiral_staircase()