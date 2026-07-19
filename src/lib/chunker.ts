/**
 * Pure helpers for chunked/resumable uploads. No I/O — safe to unit test.
 */

export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

export interface ChunkRange {
  index: number;
  offset: number;
  end: number; // exclusive
  size: number;
}

/** Enumerate all chunk ranges for a file of `totalSize` bytes. */
export function planChunks(totalSize: number, chunkSize = DEFAULT_CHUNK_SIZE): ChunkRange[] {
  if (totalSize < 0) throw new Error("totalSize must be >= 0");
  if (chunkSize <= 0) throw new Error("chunkSize must be > 0");
  const out: ChunkRange[] = [];
  let offset = 0;
  let i = 0;
  while (offset < totalSize) {
    const end = Math.min(offset + chunkSize, totalSize);
    out.push({ index: i, offset, end, size: end - offset });
    offset = end;
    i++;
  }
  return out;
}

/** Ranges that still need to be uploaded, given how many bytes the server already has. */
export function remainingChunks(
  totalSize: number,
  alreadyReceived: number,
  chunkSize = DEFAULT_CHUNK_SIZE,
): ChunkRange[] {
  const clamped = Math.max(0, Math.min(alreadyReceived, totalSize));
  return planChunks(totalSize, chunkSize).filter((c) => c.end > clamped).map((c) =>
    c.offset >= clamped
      ? c
      : { index: c.index, offset: clamped, end: c.end, size: c.end - clamped },
  );
}

/** 0..1 progress fraction, clamped. */
export function progressOf(received: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, received / total));
}
