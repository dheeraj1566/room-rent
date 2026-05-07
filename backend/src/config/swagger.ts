import env from "./env";

const apiBaseUrl = `http://localhost:${env.PORT}/api`;

export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Rent App API",
    version: "1.0.0",
    description: "API documentation for Rent App backend services.",
  },
  servers: [{ url: apiBaseUrl }],
  tags: [
    { name: "Health", description: "Service health endpoints" },
    { name: "Auth", description: "Authentication and session endpoints" },
    { name: "Profile", description: "User profile endpoints" },
    { name: "Listings", description: "Listing browse and publish endpoints" },
    { name: "Uploads", description: "Image upload endpoints" },
    { name: "Favorites", description: "Saved / liked listings" },
    { name: "Testimonials", description: "User reviews and ratings" },
    { name: "Connections", description: "Tenant-landlord contact requests" },
    { name: "Admin", description: "Admin-only management endpoints" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "jwt",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Unauthorized" },
        },
      },
    },
  },
  paths: {
    // Health
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: { "200": { description: "Service is healthy" } },
      },
    },
    // Auth
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email", "phone", "password"],
                properties: {
                  fullName: { type: "string" },
                  role: { type: "string", enum: ["Tenant", "Landlord"] },
                  gender: { type: "string", enum: ["Male", "Female"] },
                  email: { type: "string", format: "email" },
                  phone: { type: "string" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Registration successful" },
          "400": { description: "Validation error" },
          "409": { description: "Duplicate account" },
        },
      },
    },
    "/auth/verify-email": {
      get: {
        tags: ["Auth"],
        summary: "Verify email address via token",
        parameters: [
          { name: "token", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Email verified" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/auth/resend-verification": {
      post: {
        tags: ["Auth"],
        summary: "Resend email verification link",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Verification email sent" },
          "404": { description: "User not found" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Login successful" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request a password reset email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Reset email sent" },
          "404": { description: "User not found" },
        },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password using token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: {
                  token: { type: "string" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password reset successful" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Login / register via Google OAuth",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["idToken"],
                properties: { idToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Logged in" },
          "401": { description: "Invalid token" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout current user",
        responses: { "200": { description: "Logged out" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user session",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Current user" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    // Profile
    "/auth/profile": {
      get: {
        tags: ["Profile"],
        summary: "Get profile",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Profile fetched" },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Profile"],
        summary: "Create profile",
        security: [{ cookieAuth: [] }],
        responses: {
          "201": { description: "Profile saved" },
          "401": { description: "Unauthorized" },
        },
      },
      patch: {
        tags: ["Profile"],
        summary: "Update profile",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Profile updated" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    // Listings
    "/listings": {
      get: {
        tags: ["Listings"],
        summary: "Get all active listings with filters",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "minRent", in: "query", schema: { type: "number" } },
          { name: "maxRent", in: "query", schema: { type: "number" } },
          { name: "propertyTypeId", in: "query", schema: { type: "string" }, description: "Comma-separated values" },
          { name: "gender", in: "query", schema: { type: "string" }, description: "Comma-separated: Male,Female" },
          { name: "sortBy", in: "query", schema: { type: "string", enum: ["newest", "rent_asc", "rent_desc"] } },
        ],
        responses: {
          "200": { description: "Listings response" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/listings/location-options": {
      get: {
        tags: ["Listings"],
        summary: "Get available location filter options",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Location options" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/listings/location-data": {
      put: {
        tags: ["Listings"],
        summary: "Seed / update location data",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Location data updated" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/listings/mine": {
      get: {
        tags: ["Listings"],
        summary: "Get listings created by the current landlord",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "My listings" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/listings/submit": {
      post: {
        tags: ["Listings"],
        summary: "Create listing(s) with media files",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "string", description: "JSON-stringified listing payload" },
                  images: { type: "array", items: { type: "string", format: "binary" } },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Listing(s) created" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/listings/{listingId}": {
      get: {
        tags: ["Listings"],
        summary: "Get listing by ID",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Listing details" },
          "404": { description: "Not found" },
          "401": { description: "Unauthorized" },
        },
      },
      put: {
        tags: ["Listings"],
        summary: "Update a listing (with optional new media)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "string", description: "JSON-stringified update payload" },
                  images: { type: "array", items: { type: "string", format: "binary" } },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Listing updated" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        tags: ["Listings"],
        summary: "Delete a listing",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Listing deleted" },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
    },
    "/listings/{listingId}/status": {
      patch: {
        tags: ["Listings"],
        summary: "Toggle listing active/inactive status",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Status toggled" },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
    },
    // Uploads
    "/uploads/image": {
      post: {
        tags: ["Uploads"],
        summary: "Upload listing/profile image",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Image uploaded" },
          "400": { description: "Missing/invalid file" },
          "401": { description: "Unauthorized" },
          "502": { description: "Azure upload failed" },
        },
      },
    },
    // Favorites
    "/favorites": {
      get: {
        tags: ["Favorites"],
        summary: "Get user's favorited listings",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Favorites list" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/favorites/ids": {
      get: {
        tags: ["Favorites"],
        summary: "Get IDs of all favorited listings",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Array of listing IDs" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/favorites/{listingId}": {
      post: {
        tags: ["Favorites"],
        summary: "Toggle favorite on a listing",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Removed from favorites" },
          "201": { description: "Added to favorites" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    // Testimonials
    "/testimonials/subject/{subjectId}": {
      get: {
        tags: ["Testimonials"],
        summary: "Get all reviews for a user",
        parameters: [
          { name: "subjectId", in: "path", required: true, schema: { type: "string" }, description: "ID of the user being reviewed" },
        ],
        responses: {
          "200": { description: "Reviews list" },
          "404": { description: "User not found" },
        },
      },
    },
    "/testimonials": {
      post: {
        tags: ["Testimonials"],
        summary: "Create a review for a user",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subjectId", "rating", "comment"],
                properties: {
                  subjectId: { type: "string" },
                  rating: { type: "integer", minimum: 1, maximum: 5 },
                  comment: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Review created" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/testimonials/mine/{subjectId}": {
      get: {
        tags: ["Testimonials"],
        summary: "Get my review for a specific user",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "subjectId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "My review" },
          "404": { description: "No review found" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    // Connections
    "/connections": {
      post: {
        tags: ["Connections"],
        summary: "Tenant: send contact request to listing owner",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["listingId"],
                properties: {
                  listingId: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Request sent" },
          "400": { description: "Already requested" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/connections/mine": {
      get: {
        tags: ["Connections"],
        summary: "Tenant: get all my contacted listings",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Connection list" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/connections/my-status/{listingId}": {
      get: {
        tags: ["Connections"],
        summary: "Tenant: check connection status for a listing",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "listingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Status object" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/connections/landlord": {
      get: {
        tags: ["Connections"],
        summary: "Landlord: get all incoming connection requests",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Requests list" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/connections/{id}/deal-done": {
      patch: {
        tags: ["Connections"],
        summary: "Landlord: mark deal done (isConnected = true)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deal marked done" },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
    },
    "/connections/{id}/deal-close": {
      patch: {
        tags: ["Connections"],
        summary: "Landlord: close deal (status = Rejected)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deal closed" },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
    },
    "/connections/{id}/rent-payment": {
      patch: {
        tags: ["Connections"],
        summary: "Landlord: record monthly rent payment",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["OnTime", "Late"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Payment recorded" },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
    },
    "/connections/{id}": {
      delete: {
        tags: ["Connections"],
        summary: "Tenant: cancel a pending request",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Request cancelled" },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
    },
    // Admin
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "Get all users (admin only)",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Users list" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - not an admin" },
        },
      },
    },
    "/admin/properties": {
      get: {
        tags: ["Admin"],
        summary: "Get all properties (admin only)",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Properties list" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden - not an admin" },
        },
      },
    },
  },
} as const;

export default swaggerSpec;
