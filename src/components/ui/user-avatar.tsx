"use client";

import { useState } from "react";
import { User } from "lucide-react";

import { cn } from "@/lib/utils";

type UserAvatarProps = {
  image?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "text-[10px]",
  md: "text-sm",
  lg: "text-2xl",
};

const sizePixels = {
  sm: 24,
  md: 36,
  lg: 80,
};

const iconClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-9 w-9",
};

export function UserAvatar({
  image,
  name,
  size = "md",
  className,
}: UserAvatarProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);

  const initial = name?.trim().charAt(0).toLocaleUpperCase();

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted font-semibold text-muted-foreground",
        sizeClasses[size],
        className,
      )}
      style={{ width: sizePixels[size], height: sizePixels[size] }}
    >
      {image && failedImage !== image ? (
        // A native image supports both the authenticated local endpoint and OAuth provider URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name ? `${name}'s avatar` : "Profile avatar"}
          className="h-full w-full object-cover"
          onError={() => setFailedImage(image)}
        />
      ) : initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <User aria-hidden="true" className={iconClasses[size]} />
      )}
    </span>
  );
}
