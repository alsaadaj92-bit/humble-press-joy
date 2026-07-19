// Manual (user-created) albums with membership stored locally in IndexedDB.
// Purely on-device — never leaves the user's browser.
import { photoDb, type Album, type AlbumMember } from "./photoDb";

function uid() {
  return `alb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function memberId(albumId: string, assetId: string) {
  return `${albumId}:${assetId}`;
}

export async function createManualAlbum(
  name: string,
  description?: string,
): Promise<Album> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("اسم الألبوم مطلوب");
  const now = Date.now();
  const album: Album = {
    id: uid(),
    name: trimmed,
    kind: "manual",
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await photoDb.albums.put(album);
  return album;
}

export async function renameManualAlbum(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("اسم الألبوم مطلوب");
  await photoDb.albums.update(id, { name: trimmed, updatedAt: Date.now() });
}

export async function deleteManualAlbum(id: string) {
  await photoDb.transaction("rw", photoDb.albums, photoDb.albumMembers, async () => {
    await photoDb.albumMembers.where("albumId").equals(id).delete();
    await photoDb.albums.delete(id);
  });
}

export async function addAssetsToAlbum(albumId: string, assetIds: string[]) {
  const now = Date.now();
  const rows: AlbumMember[] = assetIds.map((assetId) => ({
    id: memberId(albumId, assetId),
    albumId,
    assetId,
    addedAt: now,
  }));
  await photoDb.transaction("rw", photoDb.albums, photoDb.albumMembers, async () => {
    await photoDb.albumMembers.bulkPut(rows);
    await photoDb.albums.update(albumId, { updatedAt: now });
  });
  return rows.length;
}

export async function removeAssetsFromAlbum(albumId: string, assetIds: string[]) {
  const ids = assetIds.map((a) => memberId(albumId, a));
  await photoDb.transaction("rw", photoDb.albums, photoDb.albumMembers, async () => {
    await photoDb.albumMembers.bulkDelete(ids);
    await photoDb.albums.update(albumId, { updatedAt: Date.now() });
  });
}

export async function listAlbumAssetIds(albumId: string): Promise<string[]> {
  const rows = await photoDb.albumMembers
    .where("albumId")
    .equals(albumId)
    .toArray();
  return rows.sort((a, b) => b.addedAt - a.addedAt).map((r) => r.assetId);
}

export async function countAlbumAssets(albumId: string): Promise<number> {
  return photoDb.albumMembers.where("albumId").equals(albumId).count();
}

export async function setAlbumCover(albumId: string, assetId: string) {
  await photoDb.albums.update(albumId, {
    coverAssetId: assetId,
    updatedAt: Date.now(),
  });
}
