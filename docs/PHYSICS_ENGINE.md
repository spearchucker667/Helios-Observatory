# Physics Engine

This document defines the physical models, capabilities, and explicit limitations of the Sandbox Mode (`/sandbox`) Newtonian N-body engine.

## Supported Physics

- Newtonian all-pairs gravity
- Barycentric motion
- Orbital perturbations and gravitational slingshots
- Capture under the modeled dynamics, escape, ejection
- Close encounters and collisions
- Momentum-conserving merges
- Documented fragmentation approximation
- Roche-limit estimates
- Newtonian tidal gradients
- Stellar irradiance
- Model-based equilibrium temperature
- Schwarzschild radius and event-horizon capture in the reduced Schwarzschild model
- Deterministic replay

## Unsupported Physics (Not inherently supported by Newtonian N-body)

- Atmospheric drag
- Tidal orbital decay
- Stellar mass loss
- Radiation pressure
- Relativistic apsidal precession
- Frame dragging
- Gravitational waves
- Hydrodynamic stellar collisions
- Fluid accretion
- Magnetohydrodynamics
- Supernova evolution
- Detailed crater hydrodynamics
- Realistic atmospheric stripping

A phenomenon belongs in the UI only when its model has actually been implemented.

## Internal Units

Internally, the simulation operates in strict SI units:
- Position: metres (m)
- Velocity: metres/second (m/s)
- Mass: kilograms (kg)
- Radius: metres (m)
- Time: seconds (s)
- Temperature: kelvin (K)
- Luminosity: watts (W)

All UI-level display conversions (km, AU, Earth masses, etc.) occur purely during presentation.

## Timestep and Accuracy

Simulation speed must not equal integration timestep. Time acceleration changes how many physical seconds must be consumed, not how inaccurate each physics step may become. The engine uses a deterministic substepping model based on quality settings (Fast, Standard, High) to maintain physical integrity even at high time-warp rates.
