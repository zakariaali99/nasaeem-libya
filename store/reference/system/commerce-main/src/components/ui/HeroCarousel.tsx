"use client";

import * as React from "react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { cn } from "@/lib/utils";
import { GsapCarouselPlugin } from "./GsapCarouselPlugin";

interface HeroCarouselProps {
  children: React.ReactNode[];
  className?: string;
  height?: string;
}

export function HeroCarousel({ children, className, height }: HeroCarouselProps) {
  const [ref] = useKeenSlider<HTMLDivElement>(
    {
      loop: true,
      rtl: true,
      slides: {
        perView: 'auto',
        spacing: 12,
      },
      mode: "free-snap",
    },
    [GsapCarouselPlugin]
  );

  // Default to clamp for backward compatibility
  const carouselHeight = height || "clamp(220px, 55vw, 360px)";

  return (
    <div
      ref={ref}
      dir="rtl"
      className={cn("keen-slider", className)}
      style={{ height: carouselHeight }}
    >
      {React.Children.map(children, (child, idx) => (
        <div
          className="keen-slider__slide"
          key={idx}
          style={{
            minHeight: '100%',
            overflow: 'hidden',
            borderRadius: 'inherit'
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
