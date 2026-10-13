import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImageRef } from "expo-image-manipulator";

/** Bake camera/EXIF orientation into pixels before persisting, watermarking or uploading. */
export async function normalizeFieldCaptureImage(uri: string) {
  const context = ImageManipulator.manipulate(uri);
  let image: ImageRef | undefined;
  try {
    // Expo's native decoder normalizes orientation. No fixed rotate/crop/resize is applied.
    image = await context.renderAsync();
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 1,
    });
    if (
      !result.uri ||
      !Number.isFinite(result.width) ||
      !Number.isFinite(result.height) ||
      result.width <= 0 ||
      result.height <= 0
    )
      throw new Error("Camera image could not be normalized");
    return result;
  } finally {
    image?.release();
    context.release();
  }
}
