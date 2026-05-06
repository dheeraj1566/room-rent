import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import "./Select.css";

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
  searchable?: boolean;
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
  searchable = true,
  "aria-label": ariaLabel,
}: SelectProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onScroll = (event: Event) => {
      // Don't close if scrolling within the select menu
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    const onResize = () => {
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
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : filteredOptions.findIndex((o) => !o.disabled);
    setActiveIndex(nextIndex);
  }, [open, options, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      if (searchable) {
        searchRef.current?.focus();
      } else {
        menuRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, searchable]);

  const commit = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (delta: number) => {
    if (!filteredOptions.length) return;
    let idx = activeIndex < 0 ? (delta > 0 ? -1 : filteredOptions.length) : activeIndex;
    for (let i = 0; i < filteredOptions.length; i += 1) {
      idx = clampIndex(idx + delta, filteredOptions.length);
      const opt = filteredOptions[idx];
      if (opt && !opt.disabled) {
        setActiveIndex(idx);
        const el = document.getElementById(`${id}-opt-${idx}`);
        el?.scrollIntoView({ block: "nearest" });
        break;
      }
    }
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const idx = filteredOptions.findIndex((o) => !o.disabled);
      setActiveIndex(idx);
      menuRef.current?.focus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const opt = activeIndex >= 0 ? filteredOptions[activeIndex] : filteredOptions.find((o) => !o.disabled);
      if (opt && !opt.disabled) commit(opt.value);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
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
      const opt = filteredOptions[activeIndex];
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
        <span className="ui-select-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
          {searchable ? (
            <div className="ui-select-search">
              <input
                ref={searchRef}
                type="text"
                className="ui-select-search-input"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Search..."
                aria-label="Search options"
                autoComplete="off"
              />
            </div>
          ) : null}
          {filteredOptions.length === 0 ? (
            <div className="ui-select-empty">{query ? "No results" : "No options"}</div>
          ) : (
            filteredOptions.map((opt, idx) => {
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
