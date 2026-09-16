import { useEffect, useState } from "react";

type Props = {
  className?: string;
  animated?: boolean;
};

export function HeliosMikuBrand({ className, animated = false }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const src =
    animated && !reducedMotion
      ? "/assets/miku-space/helios-miku-orbit-spinner.gif"
      : "/assets/miku-space/helios-miku-favicon.svg";

  return (
    <img
      src={src}
      className={className}
      width={48}
      height={48}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  );
}
