import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type BrandVariant =
  | "spinner"
  | "patch"
  | "moon-catalog"
  | "measurement"
  | "oort"
  | "telemetry";

type HeliosMikuBrandProps = {
  className?: string;
  variant?: BrandVariant;
  animated?: boolean;
  size?: number | string;
};

export function HeliosMikuBrand({
  className,
  variant = "spinner",
  animated = false,
  size,
}: HeliosMikuBrandProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  let src = "/assets/miku-space/helios-miku-favicon.svg";

  if (variant === "patch") {
    src = "/assets/miku-space/helios-miku-mission-patch.svg";
  } else if (variant === "moon-catalog") {
    src = "/assets/miku-space/helios-miku-moon-catalog-badge.svg";
  } else if (variant === "measurement") {
    src = "/assets/miku-space/helios-miku-measurement-badge.svg";
  } else if (variant === "oort") {
    src = "/assets/miku-space/helios-miku-oort-frontier-badge.svg";
  } else if (variant === "telemetry") {
    src = "/assets/miku-space/helios-miku-telemetry-badge.svg";
  } else if (animated && !reducedMotion) {
    src = "/assets/miku-space/animated/helios-miku-orbit-spinner.gif";
  }

  return (
    <img
      src={src}
      className={cn("select-none object-contain", className)}
      style={size ? { width: size, height: size } : undefined}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />
  );
}
