"use client";

import { useEffect, useMemo, useState } from "react";
import { parseImageUrls } from "@/lib/news-images";

type NewsImageCarouselProps = {
  imageValue: string | null;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  autoAdvanceMs?: number;
};

export function NewsImageCarousel({
  imageValue,
  alt,
  className,
  placeholderClassName,
  autoAdvanceMs,
}: NewsImageCarouselProps) {
  const images = useMemo(() => parseImageUrls(imageValue), [imageValue]);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasManyImages = images.length > 1;

  useEffect(() => {
    setActiveIndex(0);
  }, [imageValue]);

  useEffect(() => {
    if (!autoAdvanceMs || !hasManyImages) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % images.length);
    }, autoAdvanceMs);

    return () => window.clearInterval(timer);
  }, [autoAdvanceMs, hasManyImages, images.length]);

  if (images.length === 0) {
    return (
      <div className={placeholderClassName || "news-image-placeholder"} aria-hidden="true">
        MAGIC BBC
      </div>
    );
  }

  const showPrevious = () => setActiveIndex((index) => (index - 1 + images.length) % images.length);
  const showNext = () => setActiveIndex((index) => (index + 1) % images.length);

  return (
    <div className={`news-carousel ${className || ""}`}>
      {images.map((image, index) => (
        <img
          className={index === activeIndex ? "active" : ""}
          src={image}
          alt={index === activeIndex ? alt : ""}
          aria-hidden={index !== activeIndex}
          key={`${image}-${index}`}
        />
      ))}

      {hasManyImages && (
        <>
          <button
            className="news-carousel-arrow news-carousel-prev"
            type="button"
            aria-label="Previous image"
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              showPrevious();
            }}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          <button
            className="news-carousel-arrow news-carousel-next"
            type="button"
            aria-label="Next image"
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
          <div className="news-carousel-dots" aria-label="News images">
            {images.map((image, index) => (
              <button
                className={index === activeIndex ? "active" : ""}
                type="button"
                aria-label={`Show image ${index + 1}`}
                onKeyDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex(index);
                }}
                key={`${image}-dot-${index}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
