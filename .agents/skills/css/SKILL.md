---
name: krittech-frontend-standards
description: Build scalable, responsive, and production-ready frontend applications using clean architecture and reusable components.
---

# Core Rules

## Styling Rules

- Never use inline CSS
- Never use style={{}}
- Always use external CSS, CSS modules, SCSS, or Tailwind classes
- Maintain consistent spacing and typography
- Reuse existing styles before creating new ones

---

# Important Editing Rule

- Never undo or overwrite manual developer changes
- Only modify the requested section
- Preserve existing logic and comments
- Avoid unnecessary refactoring

---

# Project Structure

Always follow this structure:

src/
│
├── components/
│   ├── Button/
│   ├── Navbar/
│   ├── Modal/
│   └── Loader/
│
├── pages/
│   ├── Home/
│   │   ├── index.tsx
│   │   ├── Home.css
│   │   └── components/
│   │
│   ├── About/
│   │   ├── index.tsx
│   │   ├── About.css
│   │   └── components/
│
├── hooks/
│
├── services/
│
├── utils/
│
├── assets/
│
├── routes/
│
└── App.tsx

---

# Page Rules

- Every page must have its own folder
- Every page entry file must be:

index.tsx

Example:

pages/
 └── Home/
      ├── index.tsx
      ├── Home.css
      └── components/

- Page-specific components stay inside that page folder
- Shared reusable components go inside:

src/components/

---

# Responsive Rules

All pages and components must be fully responsive.

Support:
- Mobile
- Tablet
- Desktop

Always:
- Prevent horizontal scrolling
- Use flexible layouts
- Optimize spacing for small screens
- Maintain readable typography

---

# Error Handling Rules

Always include:
- try/catch for API calls
- loading states
- empty states
- fallback UI
- form validation
- null safety checks

Never leave:
- crashing components
- blank screens
- unhandled promise rejections

---

# Component Rules

- Keep components reusable and modular
- Avoid giant components
- Use meaningful naming
- Separate business logic when possible

---

# Code Standards

Always:
- Use TypeScript
- Use async/await
- Remove unused imports
- Use clean naming conventions
- Write readable code

Avoid:
- duplicated code
- deeply nested conditions
- hardcoded values
- unnecessary console logs

---

# Performance Rules

- Lazy load heavy components
- Optimize images
- Avoid unnecessary re-renders
- Keep bundle size optimized

---

# Accessibility Rules

Always:
- Use semantic HTML
- Add alt text to images
- Add labels for inputs
- Ensure keyboard accessibility

---

# UI Expectations

The UI should be:
- clean
- modern
- minimal
- premium
- production-ready

Maintain:
- proper spacing
- visual hierarchy
- alignment consistency

---

# Preferred Stack

Frontend:
- React
- TypeScript
- Vite

Preferred Libraries:
- React Router
- Axios
- React Query
- Framer Motion

---

# Final Checklist

Before completing any task:

- Check responsiveness
- Check TypeScript errors
- Check console errors
- Check API error handling
- Check loading states
- Preserve manual developer changes
- Maintain proper folder structure
- Ensure reusable components are extracted properly


---
name: backend-standards
description: Build scalable, secure, and production-ready backend applications with clean architecture and proper error handling.
---

# Core Backend Rules

- Always write clean and modular code
- Never break existing APIs unless explicitly instructed
- Never overwrite manual developer changes
- Keep business logic separated from routes
- Use environment variables for secrets and configs
- Never hardcode sensitive values

---

# Backend Folder Structure

Always follow this structure:

src/
│
├── controllers/
│
├── routes/
│
├── services/
│
├── middlewares/
│
├── models/
│
├── utils/
│
├── validations/
│
├── configs/
│
├── database/
│
├── constants/
│
├── types/
│
└── server.ts

---

# Route Rules

- Keep routes clean and minimal
- Do not place business logic inside routes
- Routes should only:
  - validate request
  - call controller/service
  - return response

Example:

routes → controller → service → database

---

# Controller Rules

Controllers should:
- handle request/response
- call services
- handle status codes
- handle API responses properly

Avoid:
- large controllers
- database queries directly inside controllers

---

# Service Rules

Services should:
- contain business logic
- remain reusable
- handle database interaction
- remain independent from HTTP layer

---

# Error Handling Rules

Always include:
- try/catch blocks
- centralized error handling middleware
- proper status codes
- meaningful error messages
- API validation

Never:
- expose internal server errors
- return raw stack traces
- leave unhandled promise rejections

---

# Validation Rules

Always validate:
- request body
- params
- query values

Preferred libraries:
- Zod
- Joi
- Yup

Never trust client input directly.

---

# Security Rules

Always:
- sanitize inputs
- hash passwords
- use JWT/session securely
- protect sensitive routes
- use rate limiting where needed
- validate authorization properly

Never:
- expose secrets
- trust frontend validation only
- store plain text passwords

---

# Database Rules

- Use proper schema structure
- Keep queries optimized
- Avoid duplicate queries
- Use pagination for large datasets
- Use transactions when needed

Preferred ORM:
- Prisma
- Drizzle
- Sequelize
- Mongoose

---

# API Response Rules

Use consistent API response format.

Success Example:

{
  success: true,
  message: "Data fetched successfully",
  data: {}
}

Error Example:

{
  success: false,
  message: "Invalid request"
}

---

# Logging Rules

Always:
- log server errors
- log important events
- keep logs readable

Avoid:
- excessive console.logs
- logging sensitive data

---

# Performance Rules

- Optimize database queries
- Use caching where appropriate
- Avoid blocking operations
- Use async/await
- Handle parallel requests properly

---

# Code Standards

Always:
- Use TypeScript
- Use async/await
- Use proper naming conventions
- Keep functions small
- Write reusable utilities

Avoid:
- duplicated logic
- deeply nested conditions
- giant files

---

# Authentication Rules

If authentication exists:

Always:
- protect private routes
- validate tokens
- implement refresh token strategy when needed
- handle unauthorized access properly

---

# File Upload Rules

Always:
- validate file type
- validate file size
- sanitize file names
- store securely

---

# Environment Rules

Always use:

.env

for:
- database URLs
- API keys
- JWT secrets
- third-party credentials

Never hardcode them.

---

# Preferred Stack

Backend:
- Node.js
- Express.js
- TypeScript

Preferred Libraries:
- Prisma
- Zod
- JWT
- Bcrypt
- Multer
- Nodemailer

---

# Final Checklist

Before completing any backend task:

- Check API validation
- Check error handling
- Check TypeScript errors
- Check security vulnerabilities
- Check response consistency
- Check database optimization
- Preserve manual developer changes
- Ensure modular architecture