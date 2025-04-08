import type { Metadata } from "next"
import CsvValidator from "@/components/csv-validator"

export const metadata: Metadata = {
  title: "CSV Data Validator",
  description: "A tool for validating CSV data against JSON schemas",
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 dark:from-background dark:via-background dark:to-background/95">
      <CsvValidator />
    </div>
  )
}

