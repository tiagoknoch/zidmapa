import exifr from "exifr";

const MAX_SIDE = 1600;
const QUALITY = 0.8;

// Re-encodes the photo through a canvas: resizes it, applies orientation and
// drops all EXIF metadata (including GPS) before it ever leaves the phone.
export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/jpeg",
      QUALITY,
    ),
  );
}

// GPS from the photo's EXIF, if present (usually only for gallery photos;
// mobile browsers often strip it from fresh camera captures).
export async function readPhotoGps(file: File) {
  try {
    const gps = await exifr.gps(file);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      return { lat: gps.latitude, lng: gps.longitude };
    }
  } catch {
    // no or unreadable EXIF
  }
  return null;
}

export type DevicePosition = { lat: number; lng: number; accuracy: number };

export function getDevicePosition(): Promise<DevicePosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}
