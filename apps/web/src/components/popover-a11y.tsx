"use client";

import { useEffect } from "react";

/**
 * Fills in what the browser's popover leaves to us: `aria-expanded` on the
 * button that opens it, and moving focus to the panel's first control (the
 * one marked `data-autofocus`) when it opens. Focus going back to the button
 * on close is done by the browser. Renders nothing; without JavaScript the
 * popover still opens and closes, only without these two extras.
 */
export function PopoverA11y({
  panelId,
  buttonId,
}: {
  panelId: string;
  buttonId: string;
}) {
  useEffect(() => {
    const panel = document.getElementById(panelId);
    const button = document.getElementById(buttonId);
    if (!panel || !button) return;

    const onToggle = (event: Event) => {
      const open = (event as ToggleEvent).newState === "open";
      button.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    };
    panel.addEventListener("toggle", onToggle);
    return () => panel.removeEventListener("toggle", onToggle);
  }, [panelId, buttonId]);

  return null;
}
