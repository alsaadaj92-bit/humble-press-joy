// Pure face descriptor clustering — deterministic and dependency-free so it
// can be unit tested without loading the actual face model.
// Descriptors are unit-length 128-D vectors from face-api.js.

export interface FaceLike {
  id: string;
  assetId: string;
  descriptor: number[];
  personId?: string;
}

export function euclidean(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function meanVector(vecs: number[][]): number[] {
  if (!vecs.length) return [];
  const dim = vecs[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  for (let i = 0; i < dim; i++) out[i] /= vecs.length;
  return out;
}

export interface Cluster {
  id: string;
  centroid: number[];
  faceIds: string[];
}

/**
 * Greedy online clustering — good enough for a few thousand faces and keeps
 * cluster ids stable when re-run incrementally. threshold ~0.5 works for
 * face-api's 128-D descriptors (euclidean).
 */
export function clusterFaces(
  faces: FaceLike[],
  threshold = 0.55,
  seedClusters: Cluster[] = [],
): Cluster[] {
  const clusters: Cluster[] = seedClusters.map((c) => ({
    ...c,
    faceIds: [...c.faceIds],
    centroid: [...c.centroid],
  }));
  const vecsById = new Map<string, number[][]>();
  for (const c of clusters) vecsById.set(c.id, []);

  let counter = clusters.length;
  for (const f of faces) {
    let best: { cluster: Cluster; dist: number } | null = null;
    for (const c of clusters) {
      const d = euclidean(f.descriptor, c.centroid);
      if (d < threshold && (!best || d < best.dist)) best = { cluster: c, dist: d };
    }
    if (best) {
      best.cluster.faceIds.push(f.id);
      const bucket = vecsById.get(best.cluster.id) ?? [];
      bucket.push(f.descriptor);
      vecsById.set(best.cluster.id, bucket);
      best.cluster.centroid = meanVector([best.cluster.centroid, f.descriptor]);
    } else {
      const id = `p-${++counter}`;
      const c: Cluster = { id, centroid: [...f.descriptor], faceIds: [f.id] };
      clusters.push(c);
      vecsById.set(id, [f.descriptor]);
    }
  }
  return clusters;
}
