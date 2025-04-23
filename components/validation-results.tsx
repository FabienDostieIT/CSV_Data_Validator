"use client";

import React, { memo, useCallback } from "react";
import {
  AlertTriangle,
  XCircle,
  ChevronDown,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

// Remove unused interface extension
// interface ErrorObjectWithRange extends ErrorObject { 
//   _range?: { ... };
// }

// Error Item Component for SCHEMA errors - Removed previously
// interface SchemaErrorItemProps { ... } 
// const SchemaErrorItem: React.FC<SchemaErrorItemProps> = ({ error, _index }) => { ... };

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
    (result: { row: number; errors: { property?: string; message: string }[]; warnings: { property?: string; message: string }[]; },
     // eslint-disable-next-line @typescript-eslint/no-unused-vars
     _idx: number) => {
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
              <Table className="text-xs">
                <TableBody>
                  {result.errors.length > 0 && (
                    <TableRow className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30">
                      <TableCell
                        colSpan={2}
                        className="font-bold text-red-700 dark:text-red-300"
                      >
                        Errors:
                      </TableCell>
                    </TableRow>
                  )}
                  {result.errors.map((error, _errIdx) => (
                    <TableRow
                      key={`error-${result.row}-${_errIdx}`}
                      className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                    >
                      <TableCell className="w-[150px] font-medium text-red-800 dark:text-red-200">
                        {error.property || "N/A"}
                      </TableCell>
                      <TableCell className="text-red-800 dark:text-red-200">
                        {error.message}
                      </TableCell>
                    </TableRow>
                  ))}
                  {result.warnings.length > 0 && (
                    <TableRow className="bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30">
                      <TableCell
                        colSpan={2}
                        className="font-bold text-yellow-700 dark:text-yellow-300"
                      >
                        Warnings:
                      </TableCell>
                    </TableRow>
                  )}
                  {result.warnings.map((warning, _warnIdx) => (
                    <TableRow
                      key={`warning-${result.row}-${_warnIdx}`}
                      className="bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                    >
                      <TableCell className="w-[150px] font-medium text-yellow-800 dark:text-yellow-200">
                        {warning.property || "N/A"}
                      </TableCell>
                      <TableCell className="text-yellow-800 dark:text-yellow-200">
                        {warning.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    },
    [openAccordionValue, setOpenAccordionValue, setHighlightedCsvLine, setScrollToLine], // Dependencies for useCallback
  );

  return (
    <>
      {results.map((result, index) => renderRow(result, index))}
    </>
  );
});

export default ValidationResults;
