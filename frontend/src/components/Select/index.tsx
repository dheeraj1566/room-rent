import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

const clampIndex = (index: number, length: number) => {
  if (length <= 0) return -1;
  return Math.max(0, Math.min(length - 1, index));
};

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
}: SelectProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onScrollOrResize = () => {
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled);
    setActiveIndex(nextIndex);
  }, [open, options, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      menuRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  const commit = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (delta: number) => {
    if (!options.length) return;
    let idx = activeIndex;
    for (let i = 0; i < options.length; i += 1) {
      idx = clampIndex(idx + delta, options.length);
      const opt = options[idx];
      if (opt && !opt.disabled) {
        setActiveIndex(idx);
        // Keep active option in view.
        const el = document.getElementById(`${id}-opt-${idx}`);
        el?.scrollIntoView({ block: "nearest" });
        break;
      }
    }
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((prev) => !prev);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      return;
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      const idx = options.findIndex((o) => !o.disabled);
      setActiveIndex(idx);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      for (let idx = options.length - 1; idx >= 0; idx -= 1) {
        if (!options[idx]?.disabled) {
          setActiveIndex(idx);
          break;
        }
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const opt = options[activeIndex];
      if (opt && !opt.disabled) commit(opt.value);
    }
  };

  const displayLabel = selected?.label ?? "";

  return (
    <div className={`ui-select ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="select-style ui-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`ui-select-value ${displayLabel ? "" : "placeholder"}`.trim()}>
          {displayLabel || placeholder}
        </span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className="ui-select-menu"
          aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          onKeyDown={onMenuKeyDown}
        >
          {options.length === 0 ? (
            <div className="ui-select-empty">No options</div>
          ) : (
            options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isActive = idx === activeIndex;
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  id={`${id}-opt-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    "ui-select-option",
                    isSelected ? "selected" : "",
                    isActive ? "active" : "",
                    opt.disabled ? "disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={opt.disabled}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    if (opt.disabled) return;
                    commit(opt.value);
                  }}
                >
                  <span className="ui-select-check" aria-hidden="true">
                    {isSelected ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="ui-select-label">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
