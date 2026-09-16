/**
 * Astronomical data contracts for the Helios observatory.
 *
 * Canonical science (physical/orbital quantities) is deliberately separated
 * from presentation (scene radii, orbit radii). A value in `physical` or
 * `orbit` is an astronomically sourced quantity; a value in `visualization`
 * is a rendering approximation chosen for usability and must never be read
 * as scientific scale.
 */

/** Broad astronomical classification of a tracked body. */
export type CelestialBodyKind = "star" | "planet" | "dwarf-planet" | "moon";

/**
 * Composition/formation class, surfaced in the UI.
 * Distinct from {@link CelestialBodyKind}: `kind` answers "what node is this
 * in the hierarchy", `category` answers "what is this world made of".
 */
export type BodyCategory =
  | "Star"
  | "Terrestrial"
  | "Gas giant"
  | "Ice giant"
  | "Dwarf planet"
  | "Moon"
  /** Captured/irregular small moon, rendered at reduced fidelity. */
  | "Minor moon";

/** Ring-system descriptor. Distances are in planet radii (scientific). */
export type RingSystem = {
  /** True for Saturn-like systems that dominate the visual impression. */
  prominent: boolean;
  /** Inner edge of the main ring system, in planet equatorial radii. */
  innerRadiusPlanetary: number;
  /** Outer edge of the main ring system, in planet equatorial radii. */
  outerRadiusPlanetary: number;
  /** Descriptive copy shown in the detail panel. */
  composition: string;
  /** Named divisions worth surfacing (e.g. Cassini Division). */
  divisions?: { name: string; atPlanetaryRadius: number; note: string }[];
};

/** Chemical/major constituents with approximate share by volume or mass. */
export type AtmosphereBand = { name: string; share: string };

export type PhysicalData = {
  /** Mean radius, kilometres (IAU/NASA factsheet convention). */
  meanRadiusKm: number;
  /** Equatorial diameter, kilometres. */
  diameterKm: number;
  /** kg × 10²⁴ (or relative multiples, see `massEarths`). */
  massKg24?: number;
  /** Mass relative to Earth = 1. */
  massEarths?: number;
  /** Surface (or 1-bar) gravity relative to Earth = 1. */
  gravityG: number;
  /** Escape velocity, km/s. */
  escapeVelocityKmS: number;
  /** Mean density, g/cm³. */
  densityGCm3: number;
};

export type OrbitData = {
  /** Semi-major axis, astronomical units (moons: stated in km via aNote). */
  semiMajorAxisAu?: number;
  /** Semi-major axis for satellites, kilometres from the parent's centre. */
  semiMajorAxisKm?: number;
  /** Sidereal orbital period, Earth days. */
  periodDays: number;
  /** Orbital inclination to the parent's equator (or ecliptic for planets), degrees. */
  inclinationDeg: number;
  /** Orbital eccentricity (dimensionless). */
  eccentricity?: number;
  /** Mean orbital speed, km/s, where useful for the detail panel. */
  orbitalSpeedKmS?: number;
  /** Is the orbit retrograde relative to the parent's rotation? */
  retrograde?: boolean;
  /** Tidally locked to the parent (one face permanently turned inward)? */
  tidallyLocked?: boolean;
};

export type RotationData = {
  /** Sidereal rotation period, hours. Negative = retrograde. */
  periodHours: number;
  /** Axial tilt to orbit, degrees. */
  axialTiltDeg: number;
};

export type TemperatureData = {
  /** Mean surface (or 1-bar level) temperature, °C. */
  meanC: number;
  /** Range note, e.g. Mercury's day/night extremes. */
  noteC?: { min: number; max: number };
};

/** A named, locateable surface/atmospheric feature. */
export type SurfaceFeature = {
  id: string;
  name: string;
  /** Lat/long in degrees, planetographic; omitted when only approximate. */
  lat?: number;
  lon?: number;
  /** Present when coordinates are approximate — UI must disclose this. */
  approximateLocation?: boolean;
  kind: "crater" | "basin" | "volcano" | "canyon" | "storm" | "region" | "polar" | "plume-source";
  summary: string;
};

export type BodyIdentity = {
  id: string;
  name: string;
  /** Short poetic subtitle shown under the name. */
  epithet: string;
  kind: CelestialBodyKind;
  category: BodyCategory;
  /** Parent body id (moons point at their planet; planets at "sun"). */
  parentId?: string;
  /** Representative scene/UI tint (hex). */
  color: string;
  /** Discovery info, where meaningful. */
  discovery?: {
    year: number | string;
    discoverer: string;
    note?: string;
  };
};

/** Provenance for every non-trivial number in a dataset entry. */
export type SourceRef = { id: string };

export type CelestialBody = {
  identity: BodyIdentity;
  physical: PhysicalData;
  orbit?: OrbitData;
  rotation: RotationData;
  temperature: TemperatureData;
  atmosphere?: {
    /** Surface pressure in bars (Earth = 1). Gas giants: cloud-deck level. */
    pressureBars?: number;
    composition: AtmosphereBand[];
    note?: string;
  };
  /** Interior structure summary (terrestrial worlds and icy moons). */
  interior?: string;
  magneticField?: string;
  rings?: RingSystem;
  /** Canonical moon-system counts (see docs/ASTRONOMICAL_DATA.md). */
  moonSystem?: {
    /** Confirmed natural satellites per NASA Sun fact sheet (retrieval-dated). */
    confirmedCount: number;
    note?: string;
  };
  /** Notable surface/atmospheric features, see {@link SurfaceFeature}. */
  features?: SurfaceFeature[];
  /** Editorial one-paragraph summary (overview section). */
  blurb: string;
  /** Longer notes by section key — detail-panel prose. */
  notes?: Partial<
    Record<
      | "surface"
      | "climate"
      | "interior"
      | "exploration"
      | "observations",
      string
    >
  >;
  /** Source registry ids backing this entry's figures. */
  sources: SourceRef[];
  /** Retrieval date of the canonical figures, ISO yyyy-mm-dd. */
  retrieved: string;
};

/** A natural satellite entry. Extends the body contract, adds moon specifics. */
export type MoonBody = CelestialBody & {
  identity: BodyIdentity & { kind: "moon"; parentId: string };
  /** Rendering fidelity tier — drives texture/geometry budget. */
  tier: 1 | 2;
};

/** Any selectable scene body — planets, the star, and moons alike. */
export type AnyBody = CelestialBody | MoonBody;

/**
 * A notable astronomical event: discovery, mission milestone, observation,
 * impact, atmospheric or geological finding.
 */
export type AstronomicalEvent = {
  id: string;
  bodyIds: string[];
  /** Exact date when known (ISO). `year` alone covers ancient/historical. */
  date?: string;
  year: number;
  title: string;
  category: EventCategory;
  summary: string;
  significance: string;
  /** Mission/observer credit, e.g. "NASA Cassini orbiter". */
  mission?: string;
  sourceIds: string[];
};

export type EventCategory =
  | "discovery"
  | "observation"
  | "mission"
  | "impact"
  | "atmospheric"
  | "geological"
  | "orbital"
  | "milestone";

/**
 * A space mission/archival observer, referenced by events.
 * Structured so the timeline can credit missions without duplicating prose.
 */
export type Mission = {
  id: string;
  name: string;
  operator: string;
  launch?: string;
  /** Primary targets. */
  bodyIds: string[];
  summary: string;
  milestones?: { year: number; date?: string; note: string }[];
  sourceIds: string[];
};

/** Central source registry entry — every cited fact resolves here. */
export type SourceRecord = {
  id: string;
  title: string;
  organization: string;
  url: string;
  /** Access date / retrieval date, ISO. */
  retrieved: string;
  /** What this source is trusted for. */
  scope: string;
};
