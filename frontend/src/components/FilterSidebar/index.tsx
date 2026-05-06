import { useEffect, useState } from "react";
import "./FilterSidebar.css";

type FilterState = {
  search: string;
  minRent: number;
  maxRent: number;
  maxOccupants: number[];
  furnishingTypeId: number[];
  foodPreferenceId: number[];
  coolingTypeId: number[];
  propertyTypeId: number[];
  projectStatusId: number[];
  gender: ("Male" | "Female" | "Other")[];
  sortBy: "newest" | "rent_asc" | "rent_desc";
};

type FilterSidebarProps = {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onApply: (filters: FilterState) => void;
  onClear: () => void;
};

const toggleNumber = (current: number[], value: number) =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

const toggleExclusive = <T,>(current: T[], value: T) =>
  current.includes(value) ? [] : [value];

const occupantOptions = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3+" },
  { value: 4, label: "Family" },
];

const foodPreferenceOptions = [
  { id: 1, name: "Veg Only" },
  { id: 2, name: "Non-Veg Allowed" },
  { id: 3, name: "No Restriction" },
];

const coolingOptions = [
  { id: 1, name: "AC" },
  { id: 2, name: "Non-AC" },
  { id: 3, name: "Cooler" },
];

const roomForOptions: ("Male" | "Female" | "Other")[] = ["Male", "Female", "Other"];

export default function FilterSidebar({
  filters,
  onFilterChange,
  onApply,
  onClear,
}: FilterSidebarProps) {
  const [draft, setDraft] = useState<FilterState>(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const handleApply = () => {
    onFilterChange(draft);
    onApply(draft);
  };

  const handleClear = () => {
    onClear();
  };

  return (
    <aside className="filter-panel">
      <div className="filter-header">
        <h3 className="filter-title">Filters</h3>
        <button className="btn btn-ghost" onClick={handleClear}>
          Clear all
        </button>
      </div>

      <div className="filter-section">
        <span className="filter-label">Rent</span>
        <div className="range-row">
          <div className="range-row-header">
            <span>Min</span>
            <strong>&#8377;{draft.minRent.toLocaleString("en-IN")}</strong>
          </div>
          <input
            className="range-input"
            type="range"
            min={1000}
            max={50000}
            step={500}
            value={draft.minRent}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                minRent: Math.min(Number(event.target.value), prev.maxRent),
              }))
            }
          />
        </div>
        <div className="range-row">
          <div className="range-row-header">
            <span>Max</span>
            <strong>&#8377;{draft.maxRent.toLocaleString("en-IN")}</strong>
          </div>
          <input
            className="range-input"
            type="range"
            min={1000}
            max={50000}
            step={500}
            value={draft.maxRent}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                maxRent: Math.max(Number(event.target.value), prev.minRent),
              }))
            }
          />
        </div>
      </div>

      <div className="filter-section">
        <span className="filter-label">Occupants</span>
        <div className="option-grid">
          {occupantOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`option-pill ${draft.maxOccupants.includes(option.value) ? "active" : ""}`}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  maxOccupants: toggleExclusive(prev.maxOccupants, option.value),
                }))
              }
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <span className="filter-label">Property Type</span>
        <div className="checkbox-stack">
          {[
            { id: 1, name: "PG" },
            { id: 3, name: "Flat" },
            { id: 2, name: "Individual" },
          ].map((item) => (
            <label key={item.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={draft.propertyTypeId.includes(item.id)}
                onChange={() =>
                  setDraft((prev) => ({
                    ...prev,
                    propertyTypeId: toggleExclusive(prev.propertyTypeId, item.id),
                  }))
                }
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <span className="filter-label">Furnishing</span>
        <div className="checkbox-stack">
          {[
            { id: 3, name: "Furnished" },
            { id: 2, name: "Semi-Furnished" },
            { id: 1, name: "Unfurnished" },
          ].map((item) => (
            <label key={item.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={draft.furnishingTypeId.includes(item.id)}
                onChange={() =>
                  setDraft((prev) => ({
                    ...prev,
                    furnishingTypeId: toggleNumber(prev.furnishingTypeId, item.id),
                  }))
                }
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <span className="filter-label">Project Status</span>
        <div className="checkbox-stack">
          {[
            { id: 1, name: "Under Construction" },
            { id: 2, name: "Ready to Move" },
            { id: 3, name: "New Launch" },
          ].map((item) => (
            <label key={item.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={draft.projectStatusId.includes(item.id)}
                onChange={() =>
                  setDraft((prev) => ({
                    ...prev,
                    projectStatusId: toggleNumber(prev.projectStatusId, item.id),
                  }))
                }
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <span className="filter-label">Food Preference</span>
        <div className="checkbox-stack">
          {foodPreferenceOptions.map((item) => {
            const isActive = draft.foodPreferenceId.includes(item.id);
            return (
              <label key={item.id} className={`checkbox-item checkbox-item-card ${isActive ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() =>
                    setDraft((prev) => ({
                      ...prev,
                      foodPreferenceId: toggleExclusive(prev.foodPreferenceId, item.id),
                    }))
                  }
                />
                <span>{item.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="filter-section">
        <span className="filter-label">Cooling</span>
        <div className="checkbox-stack">
          {coolingOptions.map((item) => {
            const isActive = draft.coolingTypeId.includes(item.id);
            return (
              <label key={item.id} className={`checkbox-item checkbox-item-card ${isActive ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() =>
                    setDraft((prev) => ({
                      ...prev,
                      coolingTypeId: toggleExclusive(prev.coolingTypeId, item.id),
                    }))
                  }
                />
                <span>{item.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="filter-section">
        <span className="filter-label">Room For</span>
        <div className="checkbox-stack">
          <label className={`checkbox-item checkbox-item-card ${draft.gender.length === 0 ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={draft.gender.length === 0}
              onChange={() => setDraft((prev) => ({ ...prev, gender: [] }))}
            />
            <span>Any</span>
          </label>
          {roomForOptions.map((item) => {
            const isActive = draft.gender.includes(item);
            return (
              <label key={item} className={`checkbox-item checkbox-item-card ${isActive ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() =>
                    setDraft((prev) => ({
                      ...prev,
                      gender: toggleExclusive(prev.gender, item),
                    }))
                  }
                />
                <span>{item}</span>
              </label>
            );
          })}
        </div>
      </div>

      <button className="btn btn-dark btn-block filter-apply-btn" onClick={handleApply}>
        Apply Filters
      </button>
    </aside>
  );
}
