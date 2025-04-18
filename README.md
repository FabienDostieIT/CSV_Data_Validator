# CSV Data Validator 📊✅

[![React](https://img.shields.io/badge/React-Next.js-blue?style=flat-square&logo=react)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Ajv](https://img.shields.io/badge/Schema%20Validation-Ajv-orange?style=flat-square)](https://ajv.js.org/)
[![UI](https://img.shields.io/badge/UI-Shadcn/ui-black?style=flat-square)](https://ui.shadcn.com/)

A modern web-based tool to validate CSV data against JSON schemas, edit CSVs, and ensure compliance with custom or predefined structures. Built with Next.js 15+, TypeScript, and a robust UI/UX.

---

## ✨ Features

- **CSV Upload & Editing:** Upload, edit, and validate CSV files in-browser with a code editor interface.
- **Schema Selection & Upload:** Choose from predefined JSON schemas or upload your own custom schema.
- **Live Validation:** Real-time validation using Ajv, with errors and warnings shown per row and value.
- **Detailed Results:** Errors and warnings are clearly displayed, with row numbers and schema paths.
- **Save & Download:** Download your edited CSV at any time.
- **Auto Re-validation:** CSV is re-validated after every save or edit.
- **Human-Readable Schema Docs:** View a Markdown-rendered, human-friendly version of the selected schema.
- **Responsive UI:** Panels resize and animate smoothly; results always visible.
- **Dark Mode:** Full support for light/dark themes, including logo adaptation.
- **E2E Testing:** Playwright-based end-to-end tests for reliability.
- **CI/CD:** Automated lint, test, build, and deploy via GitHub Actions.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- pnpm (or npm/yarn)

### Installation & Running Locally

```bash
# Clone the repository
git clone https://github.com/FabienDostieIT/CSV_Data_Validator.git
cd CSV_Data_Validator

# Install dependencies
pnpm install
# or npm install / yarn install

# Run the development server
pnpm dev
# or npm run dev / yarn dev

# Open http://localhost:3000 in your browser
```

---

## 🛠️ Usage Overview

1. **Upload CSV:** Drag-and-drop or select a CSV file. The content appears in the editor.
2. **Select/Upload Schema:** Choose a schema from the dropdown or upload your own JSON schema.
3. **Validate:** Click "Validate Data". Errors and warnings appear below, with details per row.
4. **Edit & Save:** Edit CSV directly, then save/download. Validation runs automatically after edits.
5. **View Schema Docs:** Toggle the schema panel to see a human-readable Markdown version of the schema.

---

## 🧪 Testing & Quality

- **Lint:**
  ```sh
  pnpm lint
  ```
- **Format:**
  ```sh
  pnpm format --check
  ```
- **Unit Tests:**
  ```sh
  pnpm test
  ```
- **E2E Tests (Playwright):**
  ```sh
  pnpm e2e
  ```

---

## ⚙️ CI/CD & Deployment

- **CI:** Automated via GitHub Actions (`.github/workflows/CI.yml`). Runs lint, format, unit tests, build, and Playwright e2e tests on every push/PR.
- **CD:** Static export and deploy to GitHub Pages via `.github/workflows/CD.yml`.
- **Static Export:**
  - Next.js 15+ uses `output: 'export'` in `next.config.mjs`.
  - Build with:
    ```sh
    pnpm build
    # Output is in the out/ directory
    ```
- **GitHub Pages:**
  - Deployment is automatic from the `main` branch to the `gh-pages` branch.
  - Configure GitHub Pages in repo settings to serve from `gh-pages` branch.

---

## 💻 Tech Stack

- **Frontend:** Next.js 15+, React 19, TypeScript
- **UI:** Shadcn/ui, Radix UI, Tailwind CSS
- **CSV Parsing:** PapaParse
- **Schema Validation:** Ajv
- **Code Editor:** Monaco/CodeMirror
- **E2E:** Playwright
- **CI/CD:** GitHub Actions

---

## 🤝 Contributing

Contributions are welcome! Please open issues or pull requests. Ensure your code passes lint, format, and all tests before submitting.

---

## 📄 License

MIT License © 2025 Fabien Dostie, [F]it

---

## 🔒 Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting and supported versions.
