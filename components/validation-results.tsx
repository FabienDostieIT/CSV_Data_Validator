"use client";

import React, { memo, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  AlertCircle as AlertIcon,
  XCircle,
  ChevronDown,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ErrorObject } from "ajv";
import * as jsonc from "jsonc-parser";
import { cn } from "@/lib/utils";

// Add _range to ErrorObject type
interface ErrorObjectWithRange extends ErrorObject {
  _range?: {
    // Define a structure similar to monaco.IRange if not globally available
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

// Error Item Component for SCHEMA errors
interface SchemaErrorItemProps {
  error: ErrorObjectWithRange; // Use extended type
  // schemaData is no longer needed here
  index: number; // Add index for unique key
}

const SchemaErrorItem: React.FC<SchemaErrorItemProps> = ({ error, index }) => {
  const instancePath = error.instancePath || error.schemaPath || "";
  const message = error.message || "Unknown error";
  const schemaPath = error.schemaPath;
  const keyword = error.keyword;

  // Get location string directly from the _range property
  let locationString = "L?:?"; // Default to placeholder
  if (
    error._range &&
    typeof error._range.startLineNumber === "number" &&
    typeof error._range.startColumn === "number"
  ) {
    locationString = `L${error._range.startLineNumber}:${error._range.startColumn}`;
  }

  return (
    <div className="py-2 px-3 border-l-4 border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-r-md text-sm">
      <pre className="whitespace-pre-wrap break-words font-sans">
        {locationString && (
          <span className="font-semibold text-orange-600 dark:text-orange-300">
            {locationString}:
          </span>
        )}{" "}
        <span className="font-semibold">{message}</span>
        {/* Display instancePath if different from schemaPath */}
        {instancePath && instancePath !== schemaPath && (
          <span className="block mt-1 text-xs text-muted-foreground">
            <span className="font-medium">Instance Path:</span> {instancePath}
          </span>
        )}
        {schemaPath && (
          <span className="block mt-1 text-xs text-muted-foreground">
            <span className="font-medium">Schema Path:</span> {schemaPath}
          </span>
        )}
        {keyword && (
          <span className="block mt-1 text-xs text-muted-foreground">
            <span className="font-medium">Keyword:</span> {keyword}
          </span>
        )}
        {error.params && (
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">Params</summary>
            <pre className="mt-1 text-xs bg-muted/50 p-1 rounded overflow-auto">
              {JSON.stringify(error.params, null, 2)}
            </pre>
          </details>
        )}
      </pre>
    </div>
  );
};

// --- ValidationResults Component (Updated) ---
interface ValidationResultsProps {
  results: {
    row: number;
    errors: { property?: string; message: string }[];
    warnings: { property?: string; message: string }[];
  }[];
  openAccordionValue: string | undefined;
  setOpenAccordionValue: (value: string | undefined) => void;
  setHighlightedCsvLine: (line: number | undefined) => void;
  setScrollToLine: (line: number | undefined) => void;
}

const ValidationResults = memo(function ValidationResults({
  results,
  openAccordionValue,
  setOpenAccordionValue,
  setHighlightedCsvLine,
  setScrollToLine,
}: ValidationResultsProps) {
  const renderRow = useCallback(
    (result: { row: number; errors: { property?: string; message: string }[]; warnings: { property?: string; message: string }[]; }, idx: number) => {
      const rowSeverity = result.errors.length > 0 ? "error" : "warning";
      const displayRowNumber = result.row;
      return (
        <Accordion
          key={result.row}
          type="single"
          collapsible
          className="w-full border-b border-muted/20 px-4"
          value={openAccordionValue}
          onValueChange={(val) => {
            setOpenAccordionValue(val);
            if (val && val.startsWith("item-")) {
              const rowIdx = parseInt(val.replace("item-", ""), 10);
              // Highlight the same row as reported (no +2 offset)
              setHighlightedCsvLine(rowIdx);
              setScrollToLine(rowIdx);
            } else {
              setHighlightedCsvLine(undefined);
              setScrollToLine(undefined);
            }
          }}
        >
          <AccordionItem value={`item-${result.row}`} className="border-b-0">
            <AccordionTrigger
              className={cn(
                "text-sm text-left hover:no-underline py-2 group flex items-center",
                rowSeverity === "error"
                  ? "data-[state=open]:text-red-700 dark:data-[state=open]:text-red-300"
                  : "data-[state=open]:text-yellow-700 dark:data-[state=open]:text-yellow-300",
              )}
            >
              <div className="flex items-center space-x-2 flex-grow truncate">
                {rowSeverity === "error" ? (
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                )}
                <span className="font-semibold">Row {displayRowNumber}:</span>
                <span className="truncate flex-grow text-muted-foreground">
                  {result.errors[0]?.message ||
                    result.warnings[0]?.message ||
                    "Unknown issue"}
                  {result.errors.length + result.warnings.length > 1
                    ? ` (+${result.errors.length + result.warnings.length - 1} more)`
                    : ""}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 ml-2 transition-transform duration-200",
                  openAccordionValue === `item-${result.row}`
                    ? "rotate-180"
                    : "",
                )}
              />
            </AccordionTrigger>
            <AccordionContent className="text-xs px-4 pt-2 pb-3 space-y-1 bg-muted/30 rounded-b">
              {result.errors.map((err, index) => (
                <div
                  key={`err-${index}`}
                  className="flex items-start text-red-600 dark:text-red-400"
                >
                  <XCircle className="h-3 w-3 mr-1.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Error:</span>{" "}
                    <span className="font-medium">{err.property || "N/A"}</span>{" "}
                    - {err.message}
                  </div>
                </div>
              ))}
              {result.warnings.map((warn, index) => (
                <div
                  key={`warn-${index}`}
                  className="flex items-start text-yellow-600 dark:text-yellow-400"
                >
                  <AlertTriangle className="h-3 w-3 mr-1.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Warning:</span>{" "}
                    <span className="font-medium">
                      {warn.property || "N/A"}
                    </span>{" "}
                    - {warn.message}
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    },
    [
      openAccordionValue,
      setOpenAccordionValue,
      setHighlightedCsvLine,
      setScrollToLine,
    ],
  );

  return <>{results.map(renderRow)}</>;
});

export default ValidationResults;
