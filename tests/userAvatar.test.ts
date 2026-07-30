import assert from "node:assert/strict";
import { test } from "node:test";

import {
  avatarImageUrl,
  avatarStorageDetails,
  createAvatarStoragePath,
  validateAvatarImage,
} from "../src/lib/userAvatar";

test("avatar validation accepts a PNG with matching file content", () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  assert.deepEqual(validateAvatarImage(png, "image/png"), {
    extension: "png",
    mimeType: "image/png",
  });
});

test("avatar validation accepts JPEG and WebP signatures", () => {
  assert.deepEqual(
    validateAvatarImage(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"),
    {
      extension: "jpg",
      mimeType: "image/jpeg",
    },
  );
  assert.deepEqual(
    validateAvatarImage(
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ]),
      "image/webp",
    ),
    {
      extension: "webp",
      mimeType: "image/webp",
    },
  );
});

test("local avatar references are exposed through the authenticated avatar endpoint", () => {
  assert.equal(
    avatarImageUrl("avatars/user-1/550e8400-e29b-41d4-a716-446655440000.png"),
    "/api/user/avatar?v=550e8400-e29b-41d4-a716-446655440000",
  );
  assert.equal(
    avatarImageUrl("https://lh3.googleusercontent.com/example"),
    "https://lh3.googleusercontent.com/example",
  );
  assert.equal(avatarImageUrl(null), null);
});

test("avatar storage references stay scoped to their owning user", () => {
  const avatarId = "550e8400-e29b-41d4-a716-446655440000";
  const storagePath = createAvatarStoragePath("user-1", "webp", avatarId);

  assert.equal(
    storagePath,
    "avatars/user-1/550e8400-e29b-41d4-a716-446655440000.webp",
  );
  assert.deepEqual(avatarStorageDetails(storagePath, "user-1"), {
    extension: "webp",
    mimeType: "image/webp",
    storagePath,
  });
  assert.equal(avatarStorageDetails(storagePath, "user-2"), null);
  assert.equal(avatarStorageDetails("../../secrets", "user-1"), null);
});

test("avatar validation rejects spoofed and oversized images", () => {
  assert.throws(
    () => validateAvatarImage(new Uint8Array([0x00, 0x01]), "image/png"),
    /content does not match/i,
  );
  assert.throws(
    () => validateAvatarImage(new Uint8Array(2 * 1024 * 1024 + 1), "image/jpeg"),
    /2 MB or smaller/i,
  );
  assert.throws(
    () => validateAvatarImage(new Uint8Array([0x47, 0x49, 0x46]), "image/gif"),
    /JPG, PNG, or WebP/i,
  );
});
