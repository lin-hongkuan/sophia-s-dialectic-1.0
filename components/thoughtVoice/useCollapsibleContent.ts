import { useEffect, useRef, useState } from 'react';

const MOBILE_PREVIEW_HEIGHT = 640;
const DESKTOP_PREVIEW_HEIGHT = 760;

interface UseCollapsibleContentOptions {
  hasContent: boolean;
  isStreaming: boolean;
}

export const useCollapsibleContent = ({ hasContent, isStreaming }: UseCollapsibleContentOptions) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(() => (
    typeof window === 'undefined'
      ? DESKTOP_PREVIEW_HEIGHT
      : window.innerWidth < 768
        ? MOBILE_PREVIEW_HEIGHT
        : DESKTOP_PREVIEW_HEIGHT
  ));
  const [contentHeight, setContentHeight] = useState(previewHeight);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePreviewHeight = () => setPreviewHeight(window.innerWidth < 768 ? MOBILE_PREVIEW_HEIGHT : DESKTOP_PREVIEW_HEIGHT);
    updatePreviewHeight();
    window.addEventListener('resize', updatePreviewHeight);
    return () => window.removeEventListener('resize', updatePreviewHeight);
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let frameId = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setContentHeight((current) => {
          const next = content.scrollHeight;
          return Math.abs(current - next) > 1 ? next : current;
        });
      });
    };

    updateHeight();
    if (typeof ResizeObserver === 'undefined') {
      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [hasContent, previewHeight]);

  const isCollapsible = contentHeight > previewHeight + 40;
  const visibleContentHeight = isStreaming ? contentHeight : (isExpanded || !isCollapsible ? contentHeight : previewHeight);
  const toggleExpanded = () => setIsExpanded((current) => !current);

  return {
    contentRef,
    isExpanded,
    isCollapsible,
    toggleExpanded,
    visibleContentHeight,
  };
};
