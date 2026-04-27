import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import SiteFooter from "../../components/SiteFooter";
import FilterSidebar from "../../components/FilterSidebar";
import ListingCard from "../../components/ListingCard";
import Select from "../../components/Select";
import Skeleton from "../../components/Skeleton";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type Listing = {
  listingId: string;
  title: string;
  colony: string;
  city: string;
  monthlyRent: number;
  rentTiers: { occupants: number; rent: number }[];
  maxOccupants: number;
  landlordGender: string | null;
  furnishingName: string;
  propertyTypeId: number | null;
  foodPreferenceName: string;
  coverPhotoUrl: string | null;
  createdAt?: string;
};

type ListingsResponse = {
  page: number;
  total: number;
  totalPages: number;
  items: Listing[];
};

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

const RENT_MIN = 1000;
const RENT_MAX = 50000;

const defaultFilters: FilterState = {
  search: "",
  minRent: RENT_MIN,
  maxRent: RENT_MAX,
  maxOccupants: [],
  furnishingTypeId: [],
  foodPreferenceId: [],
  coolingTypeId: [],
  propertyTypeId: [],
  gender: [],
  sortBy: "newest",
};

const parseNumberList = (value: string | null): number[] => {
  if (!value || !value.trim()) return [];
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
};

const parseGenderList = (value: string | null): ("Male" | "Female" | "Other")[] => {
  if (!value || !value.trim()) return [];
  const allowed = new Set(["Male", "Female", "Other"]);
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is "Male" | "Female" | "Other" => allowed.has(item));
};

export default function ListingsPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(defaultFilters); // For API calls
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [isFilterPending, setIsFilterPending] = useState(false); // Loading state for debounced filters
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: "newest", label: "Newest First" },
      { value: "rent_asc", label: "Price: Low to High" },
      { value: "rent_desc", label: "Price: High to Low" },
    ],
    [],
  );

  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  useEffect(() => {
    const sanitized = new URLSearchParams();
    const keysToKeep = [
      "page",
      "sortBy",
      "search",
      "minRent",
      "maxRent",
      "maxOccupants",
      "furnishingTypeId",
      "foodPreferenceId",
      "coolingTypeId",
      "propertyTypeId",
      "gender",
    ];
    keysToKeep.forEach((key) => {
      const value = searchParams.get(key);
      if (value) sanitized.set(key, value);
    });

    const rawPropertyTypeIds = parseNumberList(searchParams.get("propertyTypeId")).filter((value) =>
      [1, 2, 3].includes(value),
    );
    if (rawPropertyTypeIds.length > 0) {
      sanitized.set("propertyTypeId", rawPropertyTypeIds.join(","));
    } else {
      sanitized.delete("propertyTypeId");
    }

    const rawFoodPreferenceIds = parseNumberList(searchParams.get("foodPreferenceId")).filter((value) =>
      [1, 2, 3].includes(value),
    );
    if (rawFoodPreferenceIds.length > 0) {
      sanitized.set("foodPreferenceId", rawFoodPreferenceIds.join(","));
    } else {
      sanitized.delete("foodPreferenceId");
    }

    const rawCoolingTypeIds = parseNumberList(searchParams.get("coolingTypeId")).filter((value) =>
      [1, 2, 3].includes(value),
    );
    if (rawCoolingTypeIds.length > 0) {
      sanitized.set("coolingTypeId", rawCoolingTypeIds.join(","));
    } else {
      sanitized.delete("coolingTypeId");
    }

    const rawGenders = parseGenderList(searchParams.get("gender"));
    if (rawGenders.length > 0) {
      sanitized.set("gender", rawGenders.join(","));
    } else {
      sanitized.delete("gender");
    }

    if (sanitized.toString() !== searchParams.toString()) {
      setSearchParams(sanitized, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const newFilters = {
      search: searchParams.get("search") || "",
      minRent: Number(searchParams.get("minRent")) || defaultFilters.minRent,
      maxRent: Number(searchParams.get("maxRent")) || defaultFilters.maxRent,
      maxOccupants: parseNumberList(searchParams.get("maxOccupants")),
      furnishingTypeId: parseNumberList(searchParams.get("furnishingTypeId")),
      foodPreferenceId: parseNumberList(searchParams.get("foodPreferenceId")).filter((value) =>
        [1, 2, 3].includes(value),
      ),
      coolingTypeId: parseNumberList(searchParams.get("coolingTypeId")).filter((value) =>
        [1, 2, 3].includes(value),
      ),
      propertyTypeId: parseNumberList(searchParams.get("propertyTypeId")).filter((value) =>
        [1, 2, 3].includes(value),
      ),
      gender: parseGenderList(searchParams.get("gender")),
      sortBy:
        searchParams.get("sortBy") === "rent_asc" || searchParams.get("sortBy") === "rent_desc"
          ? (searchParams.get("sortBy") as "rent_asc" | "rent_desc")
          : "newest",
    };
    setFilters(newFilters);
    setDebouncedFilters(newFilters);
    setSearchInput(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ ids: string[] }>("/api/favorites/ids", { method: "GET" })
      .then((data) => setFavoriteIds(new Set(data.ids)))
      .catch(() => setFavoriteIds(new Set()));
  }, [user]);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "24");
    params.set("sortBy", debouncedFilters.sortBy);

    if (debouncedFilters.search.trim()) params.set("search", debouncedFilters.search.trim());
    if (debouncedFilters.minRent > RENT_MIN) params.set("minRent", String(debouncedFilters.minRent));
    if (debouncedFilters.maxRent < RENT_MAX) params.set("maxRent", String(debouncedFilters.maxRent));
    if (debouncedFilters.maxOccupants.length) params.set("maxOccupants", debouncedFilters.maxOccupants.join(","));
    if (debouncedFilters.furnishingTypeId.length) params.set("furnishingTypeId", debouncedFilters.furnishingTypeId.join(","));
    if (debouncedFilters.foodPreferenceId.length) params.set("foodPreferenceId", debouncedFilters.foodPreferenceId.join(","));
    if (debouncedFilters.coolingTypeId.length) params.set("coolingTypeId", debouncedFilters.coolingTypeId.join(","));
    if (debouncedFilters.propertyTypeId.length) params.set("propertyTypeId", debouncedFilters.propertyTypeId.join(","));
    if (debouncedFilters.gender.length) params.set("gender", debouncedFilters.gender.join(","));

    return `/api/listings?${params.toString()}`;
  }, [debouncedFilters, page]);

  useEffect(() => {
    let active = true;

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const load = async () => {
      setLoading(true);
      setErrorMsg("");

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        const data = await apiFetch<ListingsResponse>(queryPath, { 
          method: "GET",
          signal: abortControllerRef.current.signal
        });
        if (!active) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotalPages(Math.max(1, data.totalPages ?? 1));
      } catch (error) {
        if (!active) return;
        
        // Don't show error for aborted requests
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        
        if (error instanceof ApiError && error.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }
        setErrorMsg(error instanceof Error ? error.message : "Failed to load listings");
      } finally {
        if (active) {
          setLoading(false);
          abortControllerRef.current = null;
        }
      }
    };

    void load();

    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [queryPath, logout, navigate]);

  const updateParams = (nextFilters: FilterState, nextPage = 1) => {
    const next = new URLSearchParams();
    
    // Only add non-default parameters
    if (nextPage > 1) next.set("page", String(nextPage));
    if (nextFilters.sortBy !== "newest") next.set("sortBy", nextFilters.sortBy);
    if (nextFilters.search.trim()) next.set("search", nextFilters.search.trim());
    if (nextFilters.minRent > RENT_MIN) next.set("minRent", String(nextFilters.minRent));
    if (nextFilters.maxRent < RENT_MAX) next.set("maxRent", String(nextFilters.maxRent));
    if (nextFilters.maxOccupants.length) next.set("maxOccupants", nextFilters.maxOccupants.join(","));
    if (nextFilters.furnishingTypeId.length) next.set("furnishingTypeId", nextFilters.furnishingTypeId.join(","));
    if (nextFilters.foodPreferenceId.length) next.set("foodPreferenceId", nextFilters.foodPreferenceId.join(","));
    if (nextFilters.coolingTypeId.length) next.set("coolingTypeId", nextFilters.coolingTypeId.join(","));
    if (nextFilters.propertyTypeId.length) next.set("propertyTypeId", nextFilters.propertyTypeId.join(","));
    if (nextFilters.gender.length) next.set("gender", nextFilters.gender.join(","));
    setSearchParams(next);
  };

  // Debounced handler for ALL filter changes
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    // Update display filters immediately for visual feedback
    setFilters(newFilters);
    setIsFilterPending(true);
    
    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Set new timeout to update debounced filters after delay
    debounceRef.current = setTimeout(() => {
      setDebouncedFilters(newFilters);
      setIsFilterPending(false);
    }, 500); // 500ms debounce delay for all filters
  }, []);
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleToggleFavorite = async (listingId: string) => {
    try {
      const data = await apiFetch<{ liked: boolean }>(`/api/favorites/${listingId}`, { method: "POST" });
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (data.liked) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    } catch {
      // no-op
    }
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-shell">
        <section className="hero-panel hero-gradient">
          <div className="page-container" style={{ padding: "56px 0 52px" }}>
            <p className="eyebrow" style={{ marginBottom: 14 }}>Discover Rentals</p>
            <h1 style={{ fontSize: "clamp(2.05rem, 4.8vw, 3.25rem)", lineHeight: 1.06, marginBottom: 10 }}>
              Find your next stay with confidence
            </h1>
            <p className="section-subtitle">
              Shortlist verified homes with smart filters for budget, type and preferences.
            </p>
          </div>
        </section>

        <section className="page-section">
          <div className="page-container">
            <div className="listings-layout">
              <FilterSidebar
                filters={filters}
                onFilterChange={handleFilterChange}
                onApply={(nextFilters) => {
                  // Apply immediately, bypass debouncing
                  setDebouncedFilters(nextFilters);
                  setIsFilterPending(false);
                  if (debounceRef.current) {
                    clearTimeout(debounceRef.current);
                  }
                  updateParams(nextFilters);
                }}
                onClear={() => {
                  setFilters(defaultFilters);
                  setDebouncedFilters(defaultFilters);
                  setIsFilterPending(false);
                  updateParams(defaultFilters, 1);
                  // Clear any pending debounced changes
                  if (debounceRef.current) {
                    clearTimeout(debounceRef.current);
                  }
                }}
              />

              <div>
                <div className="sort-bar sort-bar-minimal">
                  <input
                    className="input-style sort-bar-search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const nextFilters = { ...filters, search: searchInput.trim() };
                        handleFilterChange(nextFilters);
                      }
                    }}
                    placeholder="Search area or colony"
                    aria-label="Search area or colony"
                  />

                  <div className="sort-bar-select">
                    {isFilterPending && (
                      <div className="filter-pending-indicator">
                        <div className="spinner-sm"></div>
                        <span>Updating...</span>
                      </div>
                    )}
                    <Select
                      value={filters.sortBy}
                      onChange={(next) => {
                        const nextFilters = {
                          ...filters,
                          sortBy: next as FilterState["sortBy"],
                        };
                        handleFilterChange(nextFilters);
                      }}
                      options={sortOptions}
                      aria-label="Sort listings"
                    />
                  </div>
                </div>

                {errorMsg ? <div className="error-banner">{errorMsg}</div> : null}

                <div className="listing-grid">
                  {loading
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <div key={`listing-skeleton-${index}`} className="listing-card">
                          <Skeleton style={{ aspectRatio: "1.24 / 1" }} />
                          <div style={{ padding: 18 }}>
                            <Skeleton style={{ height: 24, width: "42%", marginBottom: 10 }} />
                            <Skeleton style={{ height: 18, width: "76%", marginBottom: 8 }} />
                            <Skeleton style={{ height: 18, width: "58%", marginBottom: 14 }} />
                            <Skeleton style={{ height: 16, width: "90%" }} />
                          </div>
                        </div>
                      ))
                    : items.map((item) => (
                        <ListingCard
                          key={item.listingId}
                          listingId={item.listingId}
                          title={item.title}
                          colony={item.colony}
                          city={item.city}
                          monthlyRent={item.monthlyRent}
                          rentTiers={item.rentTiers ?? []}
                          maxOccupants={item.maxOccupants}
                          landlordGender={item.landlordGender}
                          propertyTypeId={item.propertyTypeId}
                          furnishingName={item.furnishingName}
                          foodPreferenceName={item.foodPreferenceName}
                          coverPhotoUrl={item.coverPhotoUrl}
                          isFavorited={favoriteIds.has(item.listingId)}
                          onToggleFavorite={handleToggleFavorite}
                          createdAt={item.createdAt}
                        />
                      ))}
                </div>

                {!loading && !errorMsg && items.length === 0 ? (
                  <div className="surface-card" style={{ padding: 28, marginTop: 20, textAlign: "center" }}>
                    <h3 style={{ marginBottom: 8 }}>No properties found</h3>
                    <p>Try widening your filters or searching another area.</p>
                  </div>
                ) : null}

                {totalPages > 1 ? (
                  <div className="pagination">
                    <button
                      className="btn btn-outline"
                      disabled={page <= 1}
                      onClick={() => updateParams(debouncedFilters, page - 1)}
                    >
                      Previous
                    </button>
                    <span style={{ fontWeight: 700, color: "var(--slate-700)" }}>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      className="btn btn-outline"
                      disabled={page >= totalPages}
                      onClick={() => updateParams(debouncedFilters, page + 1)}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
