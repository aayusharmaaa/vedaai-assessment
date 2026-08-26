"use client";

import { useEffect, useRef, useState } from "react";

export interface ArtworkImageProps {
  /** Path under public/, e.g. "/teacher.png". */
  src: string;
  className?: string;
  /** Leave empty for purely decorative artwork. */
  alt?: string;
  /** Rendered instead when the file is missing or fails to decode. */
  fallback: React.ReactNode;
}

/**
 * An image that degrades to inline artwork when the file is not present.
 *
 * Supplied brand assets live outside the repo, so the app has to render
 * sensibly before they are dropped into public/.
 *
 * The `onError` handler alone is not enough: the image is server-rendered, so
 * a 404 can resolve before React attaches the handler during hydration, which
 * leaves a broken-image icon on screen forever. The mount check covers that.
 */
export function ArtworkImage({ src, className, alt = "", fallback }: ArtworkImageProps) {
  const [ok, setOk] = useState(true);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el?.complete && el.naturalWidth === 0) setOk(false);
  }, []);

  if (!ok) return <>{fallback}</>;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      ref={ref}
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      onError={() => setOk(false)}
      className={className}
    />
  );
}
