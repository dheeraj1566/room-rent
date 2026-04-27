/**
 * SIMPLIFIED API CLIENT
 * Clean, easy-to-understand API layer for frontend
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

/**
 * Simple API error class
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/**
 * Simple token management
 */
export const TokenManager = {
  get: (): string | null => localStorage.getItem("auth_token"),
  set: (token: string): void => localStorage.setItem("auth_token", token),
  clear: (): void => localStorage.removeItem("auth_token"),
};

/**
 * SIMPLE API FETCH FUNCTION
 * Much cleaner than the original complex version
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Prepare headers
  const headers = new Headers(options.headers || {});
  
  // Add auth token if available
  const token = TokenManager.get();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Add content-type for JSON (unless it's FormData)
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Make the request
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include", // Important for cookies
    headers,
  });

  // Handle response
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If JSON parsing fails, use status text
      errorMessage = response.statusText || errorMessage;
    }
    
    throw new ApiError(response.status, errorMessage);
  }

  // Return JSON response
  try {
    return await response.json();
  } catch {
    // If response is not JSON, return empty object
    return {} as T;
  }
}

/**
 * CONVENIENCE METHODS
 * Simple shortcuts for common HTTP methods
 */
export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: "GET" }),
  
  post: <T>(path: string, data?: any) => 
    apiFetch<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  put: <T>(path: string, data?: any) => 
    apiFetch<T>(path, {
      method: "PUT", 
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  patch: <T>(path: string, data?: any) => 
    apiFetch<T>(path, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  
  // For file uploads
  upload: <T>(path: string, formData: FormData) =>
    apiFetch<T>(path, {
      method: "POST",
      body: formData,
    }),
};