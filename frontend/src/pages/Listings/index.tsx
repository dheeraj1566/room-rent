import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type Listing = {
  listingId: string;
  title: string;
  colony: string;
  city: string;
  monthlyRent: number;
  maxOccupants: number;
  landlordName: string;
  furnishingName: string;
  foodPreferenceName: string;
  allowSmoking: boolean;
  coverPhotoUrl: string | null;
};

type ListingsResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: Listing[];
};

type FilterState = {
  search: string;
  minRent: number;
  maxRent: number;
  maxOccupants: number[];
  floorLevelId: number[];
  furnishingTypeId: number[];
  foodPreferenceId: number[];
  allowSmoking: boolean[];
  sortBy: "newest" | "rent_asc" | "rent_desc";
};

const RENT_MIN = 1000;
const RENT_MAX = 50000;

const defaultFilters: FilterState = {
  search: "",
  minRent: RENT_MIN,
  maxRent: RENT_MAX,
  maxOccupants: [],
  floorLevelId: [],
  furnishingTypeId: [],
  foodPreferenceId: [],
  allowSmoking: [],
  sortBy: "newest",
};

const parseNumberList = (value: string | null): number[] =>
  (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "")
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

const parseBooleanList = (value: string | null): boolean[] =>
  (value || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v === "true" || v === "false")
    .map((v) => v === "true");

const toggleNumber = (current: number[], value: number): number[] =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

const toggleBoolean = (current: boolean[], value: boolean): boolean[] =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

export default function ListingsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  useEffect(() => {
    setFilters({
      search: searchParams.get("search") || "",
      minRent: Number(searchParams.get("minRent")) || defaultFilters.minRent,
      maxRent: Number(searchParams.get("maxRent")) || defaultFilters.maxRent,
      maxOccupants: parseNumberList(searchParams.get("maxOccupants")),
      floorLevelId: parseNumberList(searchParams.get("floorLevelId")),
      furnishingTypeId: parseNumberList(searchParams.get("furnishingTypeId")),
      foodPreferenceId: parseNumberList(searchParams.get("foodPreferenceId")),
      allowSmoking: parseBooleanList(searchParams.get("allowSmoking")),
      sortBy:
        searchParams.get("sortBy") === "rent_asc" || searchParams.get("sortBy") === "rent_desc"
          ? (searchParams.get("sortBy") as "rent_asc" | "rent_desc")
          : "newest",
    });
  }, [searchParams]);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "24");
    params.set("sortBy", filters.sortBy);

    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.minRent > RENT_MIN) params.set("minRent", String(filters.minRent));
    if (filters.maxRent < RENT_MAX) params.set("maxRent", String(filters.maxRent));
    if (filters.maxOccupants.length) params.set("maxOccupants", filters.maxOccupants.join(","));
    if (filters.floorLevelId.length) params.set("floorLevelId", filters.floorLevelId.join(","));
    if (filters.furnishingTypeId.length) {
      params.set("furnishingTypeId", filters.furnishingTypeId.join(","));
    }
    if (filters.foodPreferenceId.length) {
      params.set("foodPreferenceId", filters.foodPreferenceId.join(","));
    }
    if (filters.allowSmoking.length) {
      params.set("allowSmoking", filters.allowSmoking.map(String).join(","));
    }

    return `/api/listings?${params.toString()}`;
  }, [filters, page]);

  useEffect(() => {
    const loadListings = async () => {
      setLoading(true);
      setErrorMsg("");

      try {
        const data = await apiFetch<ListingsResponse>(queryPath, { method: "GET" });
        setItems(data.items);
        setBrokenImageIds(new Set());
        setTotal(data.total);
        setTotalPages(Math.max(1, data.totalPages));
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }
        setErrorMsg(error instanceof Error ? error.message : "Failed to load listings");
      } finally {
        setLoading(false);
      }
    };

    loadListings();
  }, [queryPath, logout, navigate]);

  const applyFilters = () => {
    const next = new URLSearchParams();
    next.set("page", "1");
    next.set("sortBy", filters.sortBy);
    if (filters.search.trim()) next.set("search", filters.search.trim());
    if (filters.minRent > RENT_MIN) next.set("minRent", String(filters.minRent));
    if (filters.maxRent < RENT_MAX) next.set("maxRent", String(filters.maxRent));
    if (filters.maxOccupants.length) next.set("maxOccupants", filters.maxOccupants.join(","));
    if (filters.floorLevelId.length) next.set("floorLevelId", filters.floorLevelId.join(","));
    if (filters.furnishingTypeId.length) next.set("furnishingTypeId", filters.furnishingTypeId.join(","));
    if (filters.foodPreferenceId.length) next.set("foodPreferenceId", filters.foodPreferenceId.join(","));
    if (filters.allowSmoking.length) next.set("allowSmoking", filters.allowSmoking.map(String).join(","));
    setSearchParams(next);
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setSearchParams({ page: "1" });
  };

  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  return (
    <div className="listings-layout" style={{ alignItems: "start" }}>
      <aside className="glass-card listings-sidebar" style={{ position: "sticky", top: "1rem", maxHeight: "calc(100vh - 2rem)", overflowY: "auto" }}>
        <h3 style={{ marginBottom: "1rem" }}>Filters</h3>

        <div className="form-group">
          <label>Search</label>
          <input
            className="input-style"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search locality"
          />
        </div>

        <div className="form-group">
          <label>Budget Range</label>
          <p>
            Rs. {filters.minRent.toLocaleString("en-IN")} - Rs.{" "}
            {filters.maxRent.toLocaleString("en-IN")}
          </p>
          <input
            type="range"
            min={RENT_MIN}
            max={RENT_MAX}
            step={500}
            value={filters.minRent}
            onChange={(e) => {
              const next = Number(e.target.value);
              setFilters((prev) => ({ ...prev, minRent: Math.min(next, prev.maxRent) }));
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
              setFilters((prev) => ({ ...prev, maxRent: Math.max(next, prev.minRent) }));
            }}
          />
        </div>

        <div className="form-group">
          <label>Sort</label>
          <select
            className="input-style"
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                sortBy: e.target.value as "newest" | "rent_asc" | "rent_desc",
              }))
            }
          >
            <option value="newest">Newest First</option>
            <option value="rent_asc">Rent: Low to High</option>
            <option value="rent_desc">Rent: High to Low</option>
          </select>
        </div>

        <div className="form-group">
          <label>Occupants</label>
          {[1, 2, 3, 4].map((v) => (
            <label key={v} className="checkbox-group">
              <input
                type="checkbox"
                checked={filters.maxOccupants.includes(v)}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    maxOccupants: toggleNumber(prev.maxOccupants, v),
                  }))
                }
              />
              {v}
            </label>
          ))}
        </div>

        <div className="form-group">
          <label>Floor</label>
          {[
            { id: 1, name: "Ground Floor" },
            { id: 2, name: "First Floor" },
            { id: 3, name: "Second Floor" },
            { id: 4, name: "Third Floor" },
            { id: 5, name: "Roof" },
          ].map((f) => (
            <label key={f.id} className="checkbox-group">
              <input
                type="checkbox"
                checked={filters.floorLevelId.includes(f.id)}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    floorLevelId: toggleNumber(prev.floorLevelId, f.id),
                  }))
                }
              />
              {f.name}
            </label>
          ))}
        </div>

        <div className="form-group">
          <label>Furnishing</label>
          {[
            { id: 1, name: "Unfurnished" },
            { id: 2, name: "Semi-Furnished" },
            { id: 3, name: "Fully-Furnished" },
          ].map((f) => (
            <label key={f.id} className="checkbox-group">
              <input
                type="checkbox"
                checked={filters.furnishingTypeId.includes(f.id)}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    furnishingTypeId: toggleNumber(prev.furnishingTypeId, f.id),
                  }))
                }
              />
              {f.name}
            </label>
          ))}
        </div>

        <div className="form-group">
          <label>Food Preference</label>
          {[
            { id: 1, name: "Veg Only" },
            { id: 2, name: "Non-Veg Allowed" },
            { id: 3, name: "No Restriction" },
          ].map((f) => (
            <label key={f.id} className="checkbox-group">
              <input
                type="checkbox"
                checked={filters.foodPreferenceId.includes(f.id)}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    foodPreferenceId: toggleNumber(prev.foodPreferenceId, f.id),
                  }))
                }
              />
              {f.name}
            </label>
          ))}
        </div>

        <div className="form-group">
          <label>Smoking</label>
          {[
            { value: true, label: "Smoking Allowed" },
            { value: false, label: "Non-Smoking" },
          ].map((s) => (
            <label key={String(s.value)} className="checkbox-group">
              <input
                type="checkbox"
                checked={filters.allowSmoking.includes(s.value)}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    allowSmoking: toggleBoolean(prev.allowSmoking, s.value),
                  }))
                }
              />
              {s.label}
            </label>
          ))}
        </div>

        <div className="form-group">
          <label>Bathroom</label>
          <label className="checkbox-group">
            <input type="checkbox" disabled />
            1 Bathroom
          </label>
          <label className="checkbox-group">
            <input type="checkbox" disabled />
            2+ Bathrooms
          </label>
          <p style={{ fontSize: "0.8rem" }}>Coming soon once bathroom column is added in DB.</p>
        </div>

        <div className="flex-row">
          <button className="btn btn-primary" onClick={applyFilters}>Apply</button>
          <button className="btn btn-outline" onClick={clearFilters}>Clear</button>
        </div>
      </aside>

      <section className="flex-col" style={{ gap: "0.8rem" }}>
        <div className="glass-card" style={{ padding: "1rem 1.25rem" }}>
          <div className="flex-row justify-between">
            <div>
              <h2 style={{ marginBottom: "0.25rem" }}>Rental Listings</h2>
              <p>{loading ? "Loading..." : `${total.toLocaleString("en-IN")} properties found`}</p>
            </div>
            <div className="flex-row">
              <Link to="/add-listing" style={{ textDecoration: "none" }}>
                <button className="btn btn-primary">Post Property</button>
              </Link>
              <button className="btn btn-outline" onClick={logout}>Logout</button>
            </div>
          </div>
        </div>

        {errorMsg && <div className="glass-card text-center" style={{ color: "#ef4444" }}>{errorMsg}</div>}
        {!loading && !errorMsg && items.length === 0 && (
          <div className="glass-card text-center">No matching listings found.</div>
        )}

        <div className="listings-grid" style={{ gap: "0.75rem" }}>
          {items.map((item) => (
            <article key={item.listingId} className="glass-card" style={{ padding: "0.75rem" }}>
              <div style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: "10px", overflow: "hidden", marginBottom: "0.6rem", background: "rgba(148,163,184,0.2)" }}>
                {item.coverPhotoUrl && !brokenImageIds.has(item.listingId) ? (
                  <img
                    src={item.coverPhotoUrl}
                    alt={item.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={() =>
                      setBrokenImageIds((prev) => {
                        const next = new Set(prev);
                        next.add(item.listingId);
                        return next;
                      })
                    }
                  />
                ) : null}
              </div>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.35rem" }}>
                Rs. {Number(item.monthlyRent).toLocaleString("en-IN")}
              </h3>
              <p style={{ fontSize: "0.88rem", marginBottom: "0.25rem" }}>{item.title}</p>
              <p style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}>{item.colony}, {item.city}</p>
              <p style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}>
                {item.maxOccupants} occupants | {item.furnishingName}
              </p>
              <p style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}>
                {item.foodPreferenceName} | {item.allowSmoking ? "Smoking: Yes" : "Smoking: No"}
              </p>
              <p style={{ fontSize: "0.78rem" }}>By {item.landlordName}</p>
              {item.coverPhotoUrl ? (
                <p style={{ fontSize: "0.72rem", marginTop: "0.4rem", wordBreak: "break-all" }}>
                  <a href={item.coverPhotoUrl} target="_blank" rel="noreferrer">
                    {item.coverPhotoUrl}
                  </a>
                </p>
              ) : null}
            </article>
          ))}
        </div>

        <div className="flex-row" style={{ justifyContent: "center", margin: "0.5rem 0 1rem" }}>
          <button className="btn btn-outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
          <span style={{ alignSelf: "center" }}>Page {page} / {totalPages}</span>
          <button className="btn btn-outline" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button>
        </div>
      </section>
    </div>
  );
}
