/**
 * Polyline utilities for smoothing and simplifying lat/lng paths.
 */

/**
 * Catmull-Rom spline interpolation between 4 points.
 * Produces natural-looking curves through the points.
 */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const a = 0.5 * (2 * p1);
  const b = 0.5 * (p2 - p0);
  const c = 0.5 * (2 * p0 - 5 * p1 + 4 * p2 - p3);
  const d = 0.5 * (3 * p1 - p0 - 3 * p2 + p3);
  return a + b * t + c * t * t + d * t * t * t;
}

/**
 * Smooth a polyline (array of lat/lng pairs) using Catmull-Rom spline.
 * Inserts interpolated points between existing ones.
 * @param points Array of [lat, lng] coordinates
 * @param tension Number of interpolated points per segment (1-3 recommended)
 * @returns Smoothed polyline
 */
export function smoothPolyline(
  points: [number, number][],
  tension: number = 2
): [number, number][] {
  if (points.length < 2) return points;
  if (points.length === 2) return points; // Can't smooth with just 2 points

  const result: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    result.push(p1);

    // Interpolate between p1 and p2
    for (let t = 1; t <= tension; t++) {
      const tNorm = t / (tension + 1);
      const lat = catmullRom(p0[0], p1[0], p2[0], p3[0], tNorm);
      const lng = catmullRom(p0[1], p1[1], p2[1], p3[1], tNorm);
      result.push([lat, lng]);
    }
  }

  // Add the last point
  result.push(points[points.length - 1]);

  return result;
}

/**
 * Simplify polyline using Douglas-Peucker algorithm.
 * Removes points that are too close to the line between neighbors.
 * @param points Array of [lat, lng] coordinates
 * @param tolerance Distance threshold in degrees (0.0001 ≈ 11 meters at equator)
 * @returns Simplified polyline
 */
export function simplifyPolyline(
  points: [number, number][],
  tolerance: number = 0.00001
): [number, number][] {
  if (points.length <= 2) return points;

  const dmax = perpendicularDistance(points);
  if (dmax.dist > tolerance) {
    const result1 = simplifyPolyline(points.slice(0, dmax.idx + 1), tolerance);
    const result2 = simplifyPolyline(points.slice(dmax.idx), tolerance);
    return result1.slice(0, -1).concat(result2);
  }

  return [points[0], points[points.length - 1]];
}

/**
 * Find point with max perpendicular distance in segment.
 */
function perpendicularDistance(points: [number, number][]): { dist: number; idx: number } {
  const start = points[0];
  const end = points[points.length - 1];
  let dmax = 0;
  let idx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDistance(points[i], start, end);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }

  return { dist: dmax, idx };
}

/**
 * Perpendicular distance from point to line.
 */
function pointToLineDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const num = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1);
  const den = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);

  return den === 0 ? 0 : num / den;
}

/**
 * Recursive helper for Douglas-Peucker.
 */
function simplifyPolylineRecursive(
  points: [number, number][],
  tolerance: number
): [number, number][] {
  if (points.length <= 2) return points;

  const dmax = perpendicularDistance(points);
  if (dmax.dist > tolerance) {
    const result1 = simplifyPolylineRecursive(points.slice(0, dmax.idx + 1), tolerance);
    const result2 = simplifyPolylineRecursive(points.slice(dmax.idx), tolerance);
    return result1.slice(0, -1).concat(result2);
  }

  return [points[0], points[points.length - 1]];
}
