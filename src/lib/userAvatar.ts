export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export class AvatarValidationError extends Error {}

export type AvatarImageType = {
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

const IMAGE_TYPES: Record<AvatarImageType["mimeType"], AvatarImageType> = {
  "image/jpeg": { extension: "jpg", mimeType: "image/jpeg" },
  "image/png": { extension: "png", mimeType: "image/png" },
  "image/webp": { extension: "webp", mimeType: "image/webp" },
};

const LOCAL_AVATAR_PATTERN =
  /^avatars\/([a-zA-Z0-9_-]+)\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|png|webp)$/i;
const SAFE_USER_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const IMAGE_TYPES_BY_EXTENSION: Record<
  AvatarImageType["extension"],
  AvatarImageType
> = {
  jpg: IMAGE_TYPES["image/jpeg"],
  png: IMAGE_TYPES["image/png"],
  webp: IMAGE_TYPES["image/webp"],
};

export type AvatarStorageDetails = AvatarImageType & {
  storagePath: string;
};

export function isLocalAvatarImage(image: string | null | undefined): boolean {
  return typeof image === "string" && LOCAL_AVATAR_PATTERN.test(image);
}

export function createAvatarStoragePath(
  userId: string,
  extension: AvatarImageType["extension"],
  avatarId = crypto.randomUUID(),
): string {
  if (!SAFE_USER_ID_PATTERN.test(userId)) {
    throw new Error("Invalid avatar owner");
  }

  const candidate = `avatars/${userId}/${avatarId}.${extension}`;
  if (!LOCAL_AVATAR_PATTERN.test(candidate)) {
    throw new Error("Invalid avatar identifier");
  }

  return candidate;
}

export function avatarStorageDetails(
  image: string | null | undefined,
  userId: string,
): AvatarStorageDetails | null {
  if (!image) {
    return null;
  }

  const match = LOCAL_AVATAR_PATTERN.exec(image);
  if (!match || match[1] !== userId) {
    return null;
  }

  const imageType =
    IMAGE_TYPES_BY_EXTENSION[match[3].toLowerCase() as AvatarImageType["extension"]];

  return {
    ...imageType,
    storagePath: image,
  };
}

export function avatarImageUrl(
  image: string | null | undefined,
): string | null {
  if (!image) {
    return null;
  }

  const localAvatar = LOCAL_AVATAR_PATTERN.exec(image);
  return localAvatar
    ? `/api/user/avatar?v=${localAvatar[2]}`
    : image;
}

function hasBytes(
  bytes: Uint8Array,
  expected: readonly number[],
  offset = 0,
): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

function hasMatchingSignature(
  bytes: Uint8Array,
  mimeType: AvatarImageType["mimeType"],
): boolean {
  if (mimeType === "image/jpeg") {
    return hasBytes(bytes, [0xff, 0xd8, 0xff]);
  }

  if (mimeType === "image/png") {
    return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  return (
    hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  );
}

export function validateAvatarImage(
  bytes: Uint8Array,
  mimeType: string,
): AvatarImageType {
  const imageType = IMAGE_TYPES[mimeType as AvatarImageType["mimeType"]];

  if (!imageType) {
    throw new AvatarValidationError("Avatar must be a JPG, PNG, or WebP image");
  }

  if (bytes.byteLength === 0) {
    throw new AvatarValidationError("Avatar image is empty");
  }

  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    throw new AvatarValidationError("Avatar image must be 2 MB or smaller");
  }

  if (!hasMatchingSignature(bytes, imageType.mimeType)) {
    throw new AvatarValidationError(
      "Avatar file content does not match its image type",
    );
  }

  return imageType;
}
