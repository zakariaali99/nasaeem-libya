"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useKeenSlider } from "keen-slider/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "keen-slider/keen-slider.min.css";
import { cn } from "@/lib/utils";

interface NormalCarouselProps {
  children: React.ReactNode[];
  className?: string;
  height?: string;
  showArrows?: boolean;
  autoPlay?: boolean;
}

export function NormalCarousel({
  children,
  className,
  height,
  showArrows = false,
  autoPlay = true
}: NormalCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // AutoPlay logic
  const timer = React.useRef<NodeJS.Timeout | null>(null);
  const AUTO_PLAY_INTERVAL = 4000;

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    loop: true,
    slides: {
      perView: 1,
      spacing: 15,
    },
    initial: 0,
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel);
    },
    created() {
      setLoaded(true);
    },
    dragStarted() {
      if (timer.current) clearTimeout(timer.current);
    },
    dragEnded() {
      if (autoPlay && !isPaused) {
        timer.current = setTimeout(() => {
          instanceRef.current?.next();
        }, AUTO_PLAY_INTERVAL);
      }
    },
    animationEnded() {
      if (autoPlay && !isPaused) {
        timer.current = setTimeout(() => {
          instanceRef.current?.next();
        }, AUTO_PLAY_INTERVAL);
      }
    }
  });

  // Handle Autoplay effect and Pause on Hover
  useEffect(() => {
    if (autoPlay && !isPaused && loaded) {
      timer.current = setTimeout(() => {
        instanceRef.current?.next();
      }, AUTO_PLAY_INTERVAL);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [autoPlay, isPaused, loaded, instanceRef]);

  const slidesCount = instanceRef.current?.track?.details?.slides?.length ?? 0;

  // Default to 320px for backward compatibility
  const carouselHeight = height || '320px';

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={sliderRef}
        className={cn("keen-slider rounded-xl overflow-hidden shadow-sm", className)} // Added rounded corners and shadow
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

      {/* Navigation arrows - Only show if enabled and loaded */}
      {showArrows && loaded && instanceRef.current && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              instanceRef.current?.prev();
            }}
            className={cn(
              "absolute top-1/2 left-4 transform -translate-y-1/2",
              "w-10 h-10 flex items-center justify-center rounded-full",
              "bg-white/80 backdrop-blur-md shadow-lg border border-white/20",
              "text-gray-800 transition-all duration-200 hover:bg-white hover:scale-105 active:scale-95",
              "opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0" // Subtle enter animation
            )}
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              instanceRef.current?.next();
            }}
            className={cn(
              "absolute top-1/2 right-4 transform -translate-y-1/2",
              "w-10 h-10 flex items-center justify-center rounded-full",
              "bg-white/80 backdrop-blur-md shadow-lg border border-white/20",
              "text-gray-800 transition-all duration-200 hover:bg-white hover:scale-105 active:scale-95",
              "opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0"  // Subtle enter animation
            )}
            aria-label="Next slide"
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
        </>
      )}

      {/* Dot indicators - always shown for context, but styled better */}
      {loaded && instanceRef.current && slidesCount > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
          {Array.from({ length: slidesCount }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => instanceRef.current?.moveToIdx(idx)}
              className={cn(
                "h-2 rounded-full transition-all duration-300 shadow-sm backdrop-blur-sm",
                currentSlide === idx
                  ? "w-6 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/70"
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
