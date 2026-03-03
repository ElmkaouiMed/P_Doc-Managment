"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { HugIcon } from "@/components/ui/hug-icon";
import { UiButton } from "@/components/ui/ui-button";
import { cn } from "@/lib/utils";

type ActionMenuItem = {
  id: string;
  label: string;
  icon?: unknown;
  onSelect?: () => void;
  active?: boolean;
  disabled?: boolean;
  closeOnSelect?: boolean;
};

type ActionMenuSection = {
  id?: string;
  label?: string;
  icon?: unknown;
  items: ActionMenuItem[];
};

type ActionMenuProps = {
  sections: ActionMenuSection[];
  className?: string;
  menuClassName?: string;
  triggerAriaLabel?: string;
  triggerTitle?: string;
  triggerVariant?: "primary" | "ghost" | "subtle" | "danger" | "outline";
  triggerSize?: "xs" | "sm" | "md" | "lg";
  triggerIcon?: unknown | "menu";
};

export function ActionMenu({
  sections,
  className,
  menuClassName,
  triggerAriaLabel = "Open actions",
  triggerTitle,
  triggerVariant = "outline",
  triggerSize = "xs",
  triggerIcon = "menu",
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const trigger = rootRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;
      const gap = 8;

      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const showAbove = spaceBelow < menuRect.height + gap && spaceAbove > spaceBelow;

      let top = showAbove ? triggerRect.top - menuRect.height - gap : triggerRect.bottom + gap;
      let left = triggerRect.right - menuRect.width;

      top = Math.max(margin, Math.min(top, viewportHeight - menuRect.height - margin));
      left = Math.max(margin, Math.min(left, viewportWidth - menuRect.width - margin));

      setPlacement(showAbove ? "top" : "bottom");
      setMenuStyle({
        position: "fixed",
        top,
        left,
        zIndex: 9999,
      });
    };

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = rootRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideTrigger && !insideMenu) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const raf = window.requestAnimationFrame(() => updatePosition());
    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const handleSelect = (item: ActionMenuItem) => {
    if (item.disabled) {
      return;
    }
    item.onSelect?.();
    if (item.closeOnSelect !== false) {
      setIsOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <UiButton
        type="button"
        size={triggerSize}
        variant={triggerVariant}
        iconOnly
        icon={triggerIcon}
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        onClick={() => setIsOpen((current) => !current)}
      />
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              data-side={placement}
              style={menuStyle ?? undefined}
              className={cn(
                "w-48 space-y-1 rounded-md border border-border bg-card/95 p-2 shadow-xl shadow-black/40",
                placement === "top" ? "origin-bottom" : "origin-top",
                menuClassName,
              )}
            >
              {sections.map((section, sectionIndex) => (
                <div key={section.id ?? `${section.label ?? "section"}-${sectionIndex}`} className={cn(sectionIndex > 0 ? "mt-1 border-t border-border pt-1" : "")}>
                  {section.label ? (
                    <p className="mb-1 flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {section.icon ? <HugIcon icon={section.icon} size={12} /> : null}
                      {section.label}
                    </p>
                  ) : null}
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => handleSelect(item)}
                      className={
                        item.active
                          ? "flex w-full items-center gap-2 rounded-sm bg-primary/15 px-2 py-1.5 text-left text-xs text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          : "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-background/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      }
                    >
                      {item.icon ? <HugIcon icon={item.icon} size={14} /> : null}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>,
            document.getElementById("app-font-scope") ?? document.body,
          )
        : null}
    </div>
  );
}
