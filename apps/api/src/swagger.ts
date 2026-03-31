const userRequestSchema = {
  type: "object",
  required: ["userName", "phone", "userEmail", "aadhaarNumber", "localAddress", "hometownAddress", "profilePhotoUrl"],
  properties: {
    userName: { type: "string", example: "Rohit Jain" },
    phone: { type: "string", example: "9876543210" },
    userEmail: { type: "string", format: "email", example: "rohit@example.com" },
    aadhaarNumber: { type: "string", example: "123456789012" },
    localAddress: { type: "string", example: "Bengaluru, Karnataka" },
    hometownAddress: { type: "string", example: "Jaipur, Rajasthan" },
    profilePhotoUrl: { type: "string", format: "uri", example: "https://example.com/photo.jpg" }
  }
};

const propertyRequestSchema = {
  type: "object",
  required: ["userId", "propertyName", "address", "latitude", "longitude"],
  properties: {
    userId: { type: "string", format: "uuid" },
    propertyName: { type: "string", example: "2BHK Flat" },
    address: { type: "string", example: "Indiranagar, Bengaluru" },
    latitude: { type: "number", example: 12.9716 },
    longitude: { type: "number", example: 77.5946 }
  }
};

export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Rent App API",
    version: "1.0.0"
  },
  servers: [
    {
      url: "http://localhost:4000"
    }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["System"],
        responses: {
          "200": {
            description: "Service health"
          }
        }
      }
    },
    "/users": {
      post: {
        summary: "Create user",
        tags: ["Users"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: userRequestSchema
            }
          }
        },
        responses: {
          "201": {
            description: "User created"
          },
          "409": {
            description: "Duplicate user"
          }
        }
      }
    },
    "/users/{userId}": {
      get: {
        summary: "Get user by userId",
        tags: ["Users"],
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          "200": { description: "User fetched" },
          "404": { description: "User not found" }
        }
      },
      put: {
        summary: "Update user",
        tags: ["Users"],
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: userRequestSchema
            }
          }
        },
        responses: {
          "200": { description: "User updated" },
          "404": { description: "User not found" },
          "409": { description: "Duplicate user" }
        }
      }
    },
    "/properties": {
      post: {
        summary: "Create property",
        tags: ["Properties"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: propertyRequestSchema
            }
          }
        },
        responses: {
          "201": { description: "Property added" }
        }
      },
      get: {
        summary: "List properties",
        tags: ["Properties"],
        parameters: [
          {
            name: "userId",
            in: "query",
            required: false,
            schema: { type: "string", format: "uuid" },
            description: "Pass userId to get only that user's properties"
          }
        ],
        responses: {
          "200": { description: "Properties fetched" }
        }
      }
    },
    "/properties/{propertyId}": {
      get: {
        summary: "Get property by propertyId",
        tags: ["Properties"],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Property fetched" },
          "404": { description: "Property not found" }
        }
      },
      put: {
        summary: "Update property",
        tags: ["Properties"],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: propertyRequestSchema
            }
          }
        },
        responses: {
          "200": { description: "Property updated" },
          "404": { description: "Property not found" }
        }
      },
      delete: {
        summary: "Soft delete property",
        tags: ["Properties"],
        parameters: [
          {
            name: "propertyId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Property deleted (IsActive = 0)" },
          "404": { description: "Property not found" }
        }
      }
    }
  }
} as const;