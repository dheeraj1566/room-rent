type FilterState = {
  search: string;
  minRent: number;
  maxRent: number;
  maxOccupants: number[];
  furnishingTypeId: number[];
  foodPreferenceId: number[];
  coolingTypeId: number[];
  propertyTypeId: number[];
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
  return (
    <aside className="filter-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ fontSize: "1.9rem" }}>Filters</h3>
        <button className="btn btn-ghost" onClick={onClear}>
          Clear all
        </button>
      </div>

      <div className="filter-section">
        <span className="filter-label">Budget</span>

        <div className="range-row">
          <div className="range-row-header">
            <span>Min Rent</span>
            <strong>₹{filters.minRent.toLocaleString("en-IN")}</strong>
          </div>
          <input
            className="range-input"
            type="range"
            min={1000}
            max={50000}
            step={500}
            value={filters.minRent}
            onChange={(event) =>
              onFilterChange({
                ...filters,
                minRent: Math.min(Number(event.target.value), filters.maxRent),
              })
            }
          />
        </div>

        <div className="range-row">
          <div className="range-row-header">
            <span>Max Rent</span>
            <strong>₹{filters.maxRent.toLocaleString("en-IN")}</strong>
          </div>
          <input
            className="range-input"
            type="range"
            min={1000}
            max={50000}
            step={500}
            value={filters.maxRent}
            onChange={(event) =>
              onFilterChange({
                ...filters,
                maxRent: Math.max(Number(event.target.value), filters.minRent),
              })
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
              className={`option-pill ${filters.maxOccupants.includes(option.value) ? "active" : ""}`}
              onClick={() =>
                onFilterChange({
                  ...filters,
                  maxOccupants: toggleExclusive(filters.maxOccupants, option.value),
                })
              }
            >
              {option.label}
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
                checked={filters.propertyTypeId.includes(item.id)}
                onChange={() =>
                  onFilterChange({
                    ...filters,
                    propertyTypeId: toggleExclusive(filters.propertyTypeId, item.id),
                  })
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
                checked={filters.furnishingTypeId.includes(item.id)}
                onChange={() =>
                  onFilterChange({
                    ...filters,
                    furnishingTypeId: toggleNumber(filters.furnishingTypeId, item.id),
                  })
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
            const isActive = filters.foodPreferenceId.includes(item.id);
            return (
              <label key={item.id} className={`checkbox-item checkbox-item-card ${isActive ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() =>
                    onFilterChange({
                      ...filters,
                      foodPreferenceId: toggleExclusive(filters.foodPreferenceId, item.id),
                    })
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
            const isActive = filters.coolingTypeId.includes(item.id);
            return (
              <label key={item.id} className={`checkbox-item checkbox-item-card ${isActive ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() =>
                    onFilterChange({
                      ...filters,
                      coolingTypeId: toggleExclusive(filters.coolingTypeId, item.id),
                    })
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
          {roomForOptions.map((item) => {
            const isActive = filters.gender.includes(item);
            return (
              <label key={item} className={`checkbox-item checkbox-item-card ${isActive ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() =>
                    onFilterChange({
                      ...filters,
                      gender: toggleExclusive(filters.gender, item),
                    })
                  }
                />
                <span>{item}</span>
              </label>
            );
          })}
        </div>
      </div>

      <button className="btn btn-dark btn-block" style={{ marginTop: 24 }} onClick={() => onApply(filters)}>
        Apply Filters
      </button>
    </aside>
  );
}
