/** Focus trap for modal/dialog overlays. Keeps tab cycles within the container. */
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent != null
  );
}

export interface UseFocusTrapOptions {
  /** Whether the trap is active (overlay is open). */
  active: boolean;
  /** Optional ref to focus when trap deactivates (e.g. trigger button). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** If true, focus the first focusable element when trap activates. Default true. */
  autoFocus?: boolean;
}

/**
 * Traps focus within the container when active. On deactivate, restores focus
 * to returnFocusRef.current or the previously focused element.
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>,
  options: UseFocusTrapOptions
) {
  const { active, returnFocusRef, autoFocus = true } = options;
  const previousActiveRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const returnFocusEl = returnFocusRef?.current ?? null;
    previousActiveRef.current = document.activeElement;

    const focusables = getFocusableElements(container);
    if (focusables.length === 0) return;

    if (autoFocus) {
      focusables[0].focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusableElements(container);
      if (focusables.length === 0) return;

      const current = document.activeElement;
      const idx = focusables.indexOf(current as HTMLElement);
      if (idx === -1) return;

      if (e.shiftKey) {
        if (idx === 0) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        }
      } else {
        if (idx === focusables.length - 1) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const toFocus = returnFocusEl ?? previousActiveRef.current;
      if (toFocus && typeof (toFocus as HTMLElement).focus === 'function') {
        (toFocus as HTMLElement).focus();
      }
    };
  }, [active, containerRef, returnFocusRef, autoFocus]);
}
