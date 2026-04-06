import { MapPin } from 'lucide-react';

type FilterSidebarProps = {
  filters: {
    search: string;
    minRent: number;
    maxRent: number;
    maxOccupants: number[];
    floorLevelId: number[];
    furnishingTypeId: number[];
    foodPreferenceId: number[];
    allowSmoking: boolean[];
    sortBy: 'newest' | 'rent_asc' | 'rent_desc';
  };
  onFilterChange: (filters: any) => void;
  onApply: () => void;
  onClear: () => void;
};

const RENT_MIN = 1000;
const RENT_MAX = 50000;

const toggleNumber = (current: number[], value: number): number[] =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

export default function FilterSidebar({ filters, onFilterChange, onApply, onClear }: FilterSidebarProps) {
  return (
    <aside className="filter-sidebar">
      <div className="filter-header">
        <h3>Filters</h3>
        <button className="btn-text" onClick={onClear}>Clear all</button>
      </div>

      <div className="filter-section">
        <label className="filter-label">
          <MapPin size={16} style={{ display: 'inline', marginRight: '0.375rem' }} />
          Search Location
        </label>
        <input
          className="input-style"
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          placeholder="Enter locality, city..."
        />
      </div>

      <div className="filter-section">
        <label className="filter-label">Budget</label>
        <div className="budget-display">
          ₹{filters.minRent.toLocaleString('en-IN')} - ₹{filters.maxRent.toLocaleString('en-IN')}
        </div>
        <div className="range-inputs">
          <input
            type="range"
            min={RENT_MIN}
            max={RENT_MAX}
            step={500}
            value={filters.minRent}
            onChange={(e) => {
              const next = Number(e.target.value);
              onFilterChange({ ...filters, minRent: Math.min(next, filters.maxRent) });
            }}
          />
          <input
            type="range"
            min={RENT_MIN}
            max={RENT_MAX}
            step={500}
            value={filters.maxRent}
            onChange={(e) => {
              const next = Number(e.target.value);
              onFilterChange({ ...filters, maxRent: Math.max(next, filters.minRent) });
            }}
          />
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Occupants</label>
        <div className="checkbox-grid">
          {[1, 2, 3, 4].map((v) => (
            <label key={v} className="checkbox-pill">
              <input
                type="checkbox"
                checked={filters.maxOccupants.includes(v)}
                onChange={() =>
                  onFilterChange({
                    ...filters,
                    maxOccupants: toggleNumber(filters.maxOccupants, v),
                  })
                }
              />
              <span>{v}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Furnishing</label>
        <div className="checkbox-list">
          {[
            { id: 1, name: 'Unfurnished' },
            { id: 2, name: 'Semi-Furnished' },
            { id: 3, name: 'Fully-Furnished' },
          ].map((f) => (
            <label key={f.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={filters.furnishingTypeId.includes(f.id)}
                onChange={() =>
                  onFilterChange({
                    ...filters,
                    furnishingTypeId: toggleNumber(filters.furnishingTypeId, f.id),
                  })
                }
              />
              <span>{f.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Food Preference</label>
        <div className="checkbox-list">
          {[
            { id: 1, name: 'Veg Only' },
            { id: 2, name: 'Non-Veg Allowed' },
            { id: 3, name: 'No Restriction' },
          ].map((f) => (
            <label key={f.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={filters.foodPreferenceId.includes(f.id)}
                onChange={() =>
                  onFilterChange({
                    ...filters,
                    foodPreferenceId: toggleNumber(filters.foodPreferenceId, f.id),
                  })
                }
              />
              <span>{f.name}</span>
            </label>
          ))}
        </div>
      </div>

      <button className="btn btn-primary w-full" onClick={onApply}>
        Apply Filters
      </button>
    </aside>
  );
}
