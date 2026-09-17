import type { SimulationBody } from "../domain/types.ts";

export function transformToBarycentric(bodies: SimulationBody[]): void {
  let totalMass = 0;
  let cmX = 0, cmY = 0, cmZ = 0;
  let cvX = 0, cvY = 0, cvZ = 0;

  // Calculate center of mass and velocity
  for (const b of bodies) {
    if (b.gravityRole === "massive") {
      totalMass += b.mass;
      cmX += b.mass * b.position[0];
      cmY += b.mass * b.position[1];
      cmZ += b.mass * b.position[2];
      
      cvX += b.mass * b.velocity[0];
      cvY += b.mass * b.velocity[1];
      cvZ += b.mass * b.velocity[2];
    }
  }

  if (totalMass > 0) {
    cmX /= totalMass;
    cmY /= totalMass;
    cmZ /= totalMass;
    
    cvX /= totalMass;
    cvY /= totalMass;
    cvZ /= totalMass;
  }

  // Shift all bodies (including tracers)
  for (const b of bodies) {
    b.position[0] -= cmX;
    b.position[1] -= cmY;
    b.position[2] -= cmZ;
    
    b.velocity[0] -= cvX;
    b.velocity[1] -= cvY;
    b.velocity[2] -= cvZ;
  }
}
