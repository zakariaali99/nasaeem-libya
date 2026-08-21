import { KeenSliderPlugin, KeenSliderInstance } from 'keen-slider/react';
import gsap from 'gsap';

function getWidths(containerWidth: number) {
  const active = containerWidth * 0.5;
  const intermediate = containerWidth * 0.25;
  const inactive = containerWidth * 0.125;
  return { active, intermediate, inactive };
}

export const GsapCarouselPlugin: KeenSliderPlugin = (slider) => {
  let timeline: gsap.core.Timeline | null = null;

  function animate(s: KeenSliderInstance, final = true) {
    const container = s.container as HTMLElement;
    if (!container.offsetParent) return; // Skip if not visible
    const widths = getWidths(container.offsetWidth);
    const slides = s.slides as HTMLElement[];
    const trackDetails = s.track?.details;
    if (!slides || !trackDetails) return;

    const slidesDetails = trackDetails.slides;

    if (final) {
      if (timeline) timeline.kill();
      timeline = gsap.timeline();
    }

    slides.forEach((slide, idx) => {
      const slideDetail = slidesDetails[idx];
      if (!slideDetail) return;

      const portion = slideDetail.portion;
      if (portion === 0 && s.options.loop) {
        gsap.set(slide, { opacity: 0, pointerEvents: 'none' });
        return;
      }

      const distance = Math.abs(slideDetail.distance);

      let width;
      let opacity;

      if (distance < 1) {
        width = gsap.utils.mapRange(0, 1, widths.active, widths.intermediate)(distance);
        opacity = gsap.utils.mapRange(0, 1, 1, 0.7)(distance);
      } else if (distance < 2) {
        width = gsap.utils.mapRange(1, 2, widths.intermediate, widths.inactive)(distance);
        opacity = gsap.utils.mapRange(1, 2, 0.7, 0.4)(distance);
      } else {
        width = widths.inactive;
        opacity = 0.4;
      }

      if (final) {
        const roundedDist = Math.round(distance);
        let finalWidth = widths.inactive;
        let finalOpacity = 0.4;
        let finalPointerEvents = 'none';

        if (roundedDist === 0) {
          finalWidth = widths.active;
          finalOpacity = 1;
          finalPointerEvents = 'auto';
        } else if (roundedDist === 1) {
          finalWidth = widths.intermediate;
          finalOpacity = 0.7;
        }

        timeline?.to(slide, { width: finalWidth, opacity: finalOpacity, duration: 0.3, ease: 'power2.out' }, 0);
        gsap.set(slide, { pointerEvents: finalPointerEvents });
      } else {
        gsap.set(slide, { width, opacity, pointerEvents: 'none' });
      }
    });
  }

  const finalAnimation = (s: KeenSliderInstance) => animate(s, true);
  const dragAnimation = (s: KeenSliderInstance) => animate(s, false);

  slider.on("created", finalAnimation);
  slider.on("slideChanged", finalAnimation);
  slider.on("animationEnded", finalAnimation);
  slider.on("dragged", dragAnimation);

  slider.on("updated", () => {
    finalAnimation(slider);
  });
};
