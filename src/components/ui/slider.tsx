import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-11 w-full touch-none select-none items-center",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-fg/15">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block size-4 rounded-full bg-fg shadow-[var(--shadow-border)] outline-none transition-[box-shadow,scale] duration-(--motion-quick) ease-(--ease-out) hover:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-primary/70 active:scale-[0.96]"
      aria-label="Simulation speed"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
