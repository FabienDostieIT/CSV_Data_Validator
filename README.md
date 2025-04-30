# CSV Data Validator 📊✅

[![React](https://img.shields.io/badge/React-Next.js_15+-blue?style=flat-square&logo=react)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Ajv](https://img.shields.io/badge/Validation-Ajv-orange?style=flat-square)](https://ajv.js.org/)
[![UI](https://img.shields.io/badge/UI-Shadcn/ui-black?style=flat-square)](https://ui.shadcn.com/)
[![CI Status](https://github.com/fabiendostie/CSV_Data_Validator/actions/workflows/CI.yml/badge.svg)](https://github.com/fabiendostie/CSV_Data_Validator/actions/workflows/CI.yml)

A modern, browser-based tool for validating, editing, and ensuring compliance of CSV data against predefined or custom JSON schemas. Built with Next.js, TypeScript, and Shadcn/ui.

---

## ✨ Features

- **CSV Handling:** Upload, edit (with code editor), save, and download CSV files.
- **Schema Management:** Select predefined schemas or upload custom JSON schemas.
- **Live Validation:** Real-time validation using Ajv, with errors/warnings shown per row/value.
- **Detailed Results:** Errors and warnings are clearly displayed, with row numbers and schema paths.
- **Save & Download:** Download your edited CSV at any time.
- **Auto Re-validation:** CSV is automatically re-validated shortly after edits are made in the editor.
- **Human-Readable Schema Docs:** View a Markdown-rendered, human-friendly version of the selected schema.
- **Responsive UI:** Smoothly resizing panels with light/dark mode support.
- **Automated Checks:** Robust CI/CD pipeline with linting, testing (unit & E2E), and security scans.

---

## 🚀 Getting Started

**Prerequisites:**

- Node.js (v18+ recommended)
- pnpm (or npm/yarn)

**Installation & Running Locally:**

```bash
# 1. Clone the repository
git clone https://github.com/FabienDostieIT/CSV_Data_Validator.git
cd CSV_Data_Validator

# 2. Install dependencies
pnpm install

# 3. Run the development server
pnpm dev

# 4. Open http://localhost:3000 in your browser
```

---

## 🛠️ Usage

1.  **Upload/Edit CSV:** Provide your CSV via drag-and-drop or file selection. Edit directly in the editor.
2.  **Select/Upload Schema:** Choose a schema from the dropdown or upload your own.
3.  **Validate:** Click "Validate Data" to see errors/warnings.
4.  **View Docs:** Toggle the schema panel to view its Markdown documentation.
5.  **Save/Download:** Save changes to trigger re-validation or download the edited CSV.

### Managing Local Schemas

- **Location:** Predefined schemas are located in the `schemas/v1/` directory.
- **Adding New Schemas:** To add your own schema for local validation, simply place your `.json` schema file inside the `schemas/v1/` directory. The application will automatically pick it up and list it in the schema selection dropdown after a refresh.
- **Schema Naming:** Ensure your schema file has a `.json` extension.

---

## 🧪 Quality & Testing

This project uses a layered approach for quality assurance:

<details>
  <summary><strong>Automated Checks Workflow (Click to Expand)</strong></summary>

- **Pre-Commit (`lint-staged`):**
  - _Purpose:_ Auto-formats and fixes basic lint errors on staged files.
  - _Benefit:_ Ensures clean commit history; fast feedback.
- **Pre-Push (`husky`):**
  - _Purpose:_ Local safeguard checking lint, types (`tsc --noEmit`), and unit tests (`pnpm test:unit`) on the entire code being pushed.
  - _Benefit:_ Prevents pushing broken code; catches issues missed by pre-commit.
- **CI (`GitHub Actions`):** \* _Purpose:_ Definitive quality gate (lint, all tests, build, security scans) in a clean environment. \* _Benefit:_ Ensures merged code meets all standards; catches anything missed locally.
</details>

**Manual Checks:**

```sh
# Lint check
pnpm lint

# Format check (Prettier)
pnpm format --check

# Run unit tests
pnpm test:unit

# Run all tests (unit + integration)
pnpm test

# Run E2E tests (Playwright)
pnpm e2e
```

---

## ⚙️ CI/CD & Deployment

- **CI (`.github/workflows/CI.yml`):** Runs automatically on pushes/PRs to `main` and `develop`. Includes lint, format check, full tests (`pnpm test`), build, and E2E tests.
- **CodeQL (`.github/workflows/codeql-analysis.yml`):** Performs security analysis.
- **Vercel Deployment (`.github/workflows/vercel.yml`):** Deploys the application to Vercel from the `main` branch using `BetaHuhn/deploy-to-vercel-action@v1`.
- **Preview Deployments:** Automatically creates preview deployments for pull requests with PR comments showing deployment URLs.
- **Vercel Configuration:** Uses `vercel.json` to define build settings and other configuration.
- **2025 Compatibility:** All workflows are updated to use the latest GitHub Actions (v4+) and include the 2025-compatible cache keys that will remain functional after the April 2025 GitHub cache service changes.

### Setting up Vercel Deployment

To set up deployments to Vercel, you need to add the following secrets to your GitHub repository:

1. `VERCEL_TOKEN`: Your Vercel API token
2. `VERCEL_PROJECT_ID`: Your Vercel project ID
3. `VERCEL_ORG_ID`: Your Vercel organization ID
4. `GITHUB_TOKEN`: Automatically provided by GitHub Actions

You can obtain the Vercel values from the Vercel dashboard or by running:

```bash
vercel link
```

These secrets are required for both the production deployment workflow (`vercel.yml`) and the preview deployments in the CI workflow.

### Testing GitHub Actions Locally

This project includes tools to test GitHub Actions workflows locally before pushing changes to GitHub:

1. Install [act](https://github.com/nektos/act) if you haven't already:

   ```bash
   # Linux/macOS with Homebrew
   brew install act

   # Or with npm
   npm install -g @nektos/act
   ```

2. Use the provided script to securely test workflows:

   ```bash
   # Source the script to load the function
   source act-secrets.sh

   # Test the Vercel deployment workflow
   run_act_workflow .github/workflows/vercel.yml push

   # Test the CI workflow with PR preview
   run_act_workflow .github/workflows/CI.yml pull_request
   ```

The script will prompt for your GitHub and Vercel credentials, which are never stored on disk and only kept in memory during the test.

You'll need to create:

- A [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo` scope
- Vercel credentials as mentioned in the deployment section

---

## 💻 Tech Stack

- **Framework:** Next.js 15+ (React 19)
- **Language:** TypeScript 5+
- **UI:** Shadcn/ui, Radix UI, Tailwind CSS
- **Validation:** Ajv
- **CSV Parsing:** PapaParse
- **Editor:** Monaco Editor
- **Testing:** Jest (Unit), Playwright (E2E)
- **CI/CD:** GitHub Actions, Husky, lint-staged

---

## 🤝 Contributing

Contributions, issues, and pull requests are welcome! Please ensure all checks (lint, tests) pass before submitting a PR.

---

## 📄 License

MIT © 2025 Fabien Dostie, [F]it

---

## 🔒 Security

Refer to [SECURITY.md](./SECURITY.md) for vulnerability reporting details.
