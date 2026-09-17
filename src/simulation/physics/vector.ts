/**
 * 3D Vector Math Utilities (SI units / Float64 operations)
 */

export type Vector3 = [number, number, number];

export function vec3Create(x = 0, y = 0, z = 0): Vector3 {
  return [x, y, z];
}

export function vec3Clone(v: Vector3): Vector3 {
  return [v[0], v[1], v[2]];
}

export function vec3Add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(v: Vector3, s: number): Vector3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Dot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3MagSq(v: Vector3): number {
  return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
}

export function vec3Mag(v: Vector3): number {
  return Math.sqrt(vec3MagSq(v));
}

export function vec3DistSq(a: Vector3, b: Vector3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export function vec3Dist(a: Vector3, b: Vector3): number {
  return Math.sqrt(vec3DistSq(a, b));
}

export function vec3Normalize(v: Vector3): Vector3 {
  const m = vec3Mag(v);
  if (m === 0) return [0, 0, 0];
  return [v[0] / m, v[1] / m, v[2] / m];
}
