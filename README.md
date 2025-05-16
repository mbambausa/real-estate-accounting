## README.md
# Real Estate Accounting Application

**Version:** 0.0.1 (Initial Development)
**Last Updated:** May 16, 2025

## 1. Project Description

A zero-cost, high-performance web application designed for real estate owners. This application provides GAAP-compliant accounting features, including double-entry bookkeeping, comprehensive entity management, detailed transaction tracking, and robust financial reporting. It boasts an intuitive user interface, minimal server resource usage, and is built for scalability.

The system capably manages multiple properties, offering distinct treatment for recoverable and non-recoverable expenses. It also supports notes receivable (loan) management and features intelligent auto-categorization for common financial transactions. Authentication is handled securely using Auth.js, with data persisted in Cloudflare D1. All data access and modifications are performed via secure API endpoints deployed on Cloudflare Workers.

The primary goal is to offer a powerful, reliable accounting solution with zero ongoing operational costs for the end-user.

## 2. Key Features

* **GAAP-Compliant Double-Entry Bookkeeping:** Accurate and reliable accounting core.
* **Entity Management:** Create and manage multiple real estate entities, including parent-subsidiary relationships.
* **Chart of Accounts:** Standardized and customizable chart of accounts with clear categorization for recoverable/non-recoverable expenses.
* **Transaction Management:**
    * Manual transaction entry.
    * CSV transaction imports with auto-categorization.
    * Advanced search, filtering, and sorting.
    * Attach documents (receipts, invoices) to transactions (via Cloudflare R2).
* **Financial Reporting:**
    * Income Statement, Balance Sheet, Cash Flow Statement.
    * Detailed reporting on recoverable vs. non-recoverable expenses.
    * Export reports to CSV/PDF.
    * Interactive dashboard with key financial metrics.
* **Notes Receivable (Loan Management):** Track loans, calculate amortization, process payments, and manage interest accruals.
* **Secure Authentication:** Single-user authentication powered by Auth.js.
* **Tax Reporting Aids:** Generate tax worksheets and track depreciation schedules.
* **Data Backup & Recovery:** Utilizes Cloudflare D1 Time Travel and provides manual data export options.
* **Performance Optimized:** Built for speed with Lighthouse scores aiming for 95+.
* **Responsive Design:** Accessible and usable across desktop, tablet, and mobile devices.
* **Zero Operational Cost:** Leverages Cloudflare's generous free tiers.

## 3. Tech Stack Overview

* **Frontend:**
    * **Astro:** Static Site Generation, page rendering, and routing.
    * **HTMX:** Dynamic HTML-over-the-wire interactions.
    * **Alpine.js:** Minimal client-side JavaScript interactivity.
    * **UnoCSS:** Instant on-demand atomic CSS engine.
    * **Chart.js:** For data visualization and charts (lazy-loaded).
    * **pdf-lib:** For client-side PDF generation (dynamically imported).
* **Backend (API Layer & Data Persistence):**
    * **Cloudflare Workers:** Serverless functions for API endpoints.
    * **Cloudflare D1:** Serverless SQLite database for primary data storage.
        * *(Consideration: `@astrojs/db` for type-safe queries and schema management).*
    * **Cloudflare R2:** Object storage for document attachments.
    * **Cloudflare KV:** Key-value store for caching reports and frequently accessed data.
    * **Zod:** API input validation.
* **Authentication:**
    * **Auth.js (v5.x):** Core authentication library.
    * **`@auth/d1-adapter`:** Cloudflare D1 adapter for Auth.js.
    * **`@node-rs/argon2`:** Secure password hashing.
    * **`csrf-csrf` (or similar):** Robust CSRF protection.
* **Financial Logic:**
    * **`decimal.js-light` (or `decimal.js`):** For precise financial calculations.
* **Development & Quality:**
    * **TypeScript:** Static typing for the entire stack.
    * **ESLint & Prettier:** Code linting and formatting.
    * **Vitest:** Unit and integration testing.
    * **Playwright:** End-to-end testing.
    * **Wrangler CLI:** Cloudflare development and deployment tool.
    * **Dependabot/Renovate & Snyk/GitHub Code Scanning:** Dependency management and vulnerability scanning.

## 4. Getting Started

### Prerequisites

* Node.js (latest LTS version recommended)
* npm (or your preferred package manager like pnpm or yarn)
* A Cloudflare account (for D1, R2, KV, Workers, Pages deployment)
* Wrangler CLI installed and configured globally: `npm install -g wrangler`

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd real-estate-accounting
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Cloudflare Setup:**
    * Log in to Wrangler: `wrangler login`
    * Create your D1 database(s) as per the schema. Update `wrangler.toml` with your D1 binding(s) and database ID(s).
        ```toml
        # Example in wrangler.toml
        [[d1_databases]]
        binding = "DB" # or your chosen binding name
        database_name = "your-database-name"
        database_id = "your-database-id"
        # Add other bindings for KV, R2 as needed
        ```
    * Set up R2 buckets and KV namespaces if not done via Wrangler.

4.  **Environment Variables:**
    * Create a `.env` file in the root of the project (this file should be in `.gitignore`).
    * Add necessary environment variables for Auth.js (e.g., `AUTH_SECRET`, provider credentials if any), database connection details for local development (if applicable), etc.
        ```env
        # Example .env content
        AUTH_SECRET="your-super-secret-auth-secret-key"
        # For @astrojs/db local development with libSQL:
        # ASTRO_DB_REMOTE_URL="file:local.db"
        # Add other variables as needed
        ```

### Running Locally (Development Mode)

* **Generate types (especially if using `@astrojs/db` or for worker types):**
    ```bash
    npm run wrangler:types # (You might have a script like `wrangler types`)
    ```
* **Start the development server (Astro dev server + Wrangler for local Workers/D1 emulation):**
    Your `package.json` has: `"dev": "wrangler types && astro dev"`
    ```bash
    npm run dev
    ```
    This will typically start the Astro development server. For full local simulation of Cloudflare services (Workers, D1, KV), you might use a command like:
    ```bash
    # If using wrangler pages dev for full simulation:
    # npm run pages:dev
    # This usually requires a build first: npm run build
    # Check your package.json scripts for the exact command.
    ```
    Access the application at `http://localhost:4321` (or the port specified by Astro/Wrangler).

### Building for Production

```bash
npm run build