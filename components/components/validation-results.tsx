"use client"

import { AlertTriangle, CheckCircle, Info, AlertCircle as AlertIcon } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { ErrorObject } from "ajv"
import * as jsonc from 'jsonc-parser';

// Add _range to ErrorObject type
interface ErrorObjectWithRange extends ErrorObject {
  _range?: { // Define a structure similar to monaco.IRange if not globally available
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
  const instancePath = error.instancePath || error.schemaPath || '';
  const message = error.message || 'Unknown error';
  const schemaPath = error.schemaPath;
  const keyword = error.keyword;

  // Get location string directly from the _range property
  let locationString = "L?:?"; // Default to placeholder
  if (error._range && typeof error._range.startLineNumber === 'number' && typeof error._range.startColumn === 'number') {
      locationString = `L${error._range.startLineNumber}:${error._range.startColumn}`;
  }

  return (
    <div className="py-2 px-3 border-l-4 border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-r-md text-sm">
        <pre className="whitespace-pre-wrap break-words font-sans">
            {locationString && <span className="font-semibold text-orange-600 dark:text-orange-300">{locationString}:</span>}{' '}
            <span className="font-semibold">{message}</span>
            {/* Display instancePath if different from schemaPath */}
            {instancePath && instancePath !== schemaPath && <span className="block mt-1 text-xs text-muted-foreground"><span className="font-medium">Instance Path:</span> {instancePath}</span>}
            {schemaPath && <span className="block mt-1 text-xs text-muted-foreground"><span className="font-medium">Schema Path:</span> {schemaPath}</span>}
            {keyword && <span className="block mt-1 text-xs text-muted-foreground"><span className="font-medium">Keyword:</span> {keyword}</span>}
            {error.params && (
                <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium">Params</summary>
                    <pre className="mt-1 text-xs bg-muted/50 p-1 rounded overflow-auto">{JSON.stringify(error.params, null, 2)}</pre>
                </details>
            )}
        </pre>
    </div>
  );
};

// --- ValidationResults Component (Updated) ---
interface ValidationResultsProps {
  results: {
    schemaIsValid: boolean;
    schemaErrors?: ErrorObjectWithRange[]; // Use extended type
    parseError?: string | null;
  };
  schemaData?: string; // schemaData no longer strictly needed by SchemaErrorItem
}

export default function ValidationResults({ results }: ValidationResultsProps) { // Remove schemaData prop if unused
  const { schemaIsValid, schemaErrors = [], parseError } = results;

  // Create a unified error array
  let displayableErrors: { message: string; instancePath?: string; isParseError?: boolean; rawError?: ErrorObjectWithRange }[] = []; // Use extended type

  if (parseError) {
    displayableErrors.push({ message: parseError, isParseError: true });
  } else {
    displayableErrors = schemaErrors.map(err => ({
        message: err.message || 'Unknown error',
        instancePath: err.instancePath || err.schemaPath || '',
        isParseError: false,
        rawError: err // Pass the raw error object for SchemaErrorItem
    }));
  }

  const totalErrors = displayableErrors.length;
  const overallValid = !parseError && schemaIsValid;

  // No need to render anything if valid and no errors
  // if (overallValid && totalErrors === 0) {
  //   return (
  //       <div className="flex items-center p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
  //           <CheckCircle className="h-5 w-5 mr-2" />
  //           <span className="font-medium">Schema is VALID according to the selected official draft</span>
  //       </div>
  //   );
  // }

  return (
    <div className="space-y-4">
        {/* Always show Overall Status */}
        <div className={`flex items-center p-3 rounded-md ${overallValid ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
            {overallValid ? <CheckCircle className="h-5 w-5 mr-2" /> : <AlertTriangle className="h-5 w-5 mr-2" />}
            <span className="font-medium">{
                parseError 
                ? 'Schema has Syntax Errors' 
                : (schemaIsValid ? 'Schema is VALID according to the selected official draft' : 'Schema is INVALID according to the selected official draft')
            }</span>
        </div>

      {/* Always render Accordion if there are *any* errors (parse or schema) */}
      {totalErrors > 0 && (
        <Accordion type="single" collapsible defaultValue="schema-errors" className="w-full">
            <AccordionItem value="schema-errors">
                <AccordionTrigger className="text-base font-medium px-3 py-2 hover:bg-muted/50 dark:hover:bg-zinc-700/30 rounded-md">
                    <div className="flex items-center justify-between w-full">
                        {/* Adjust title slightly based on error type? Or keep generic? */}                       
                        <span className="flex items-center">
                           <AlertIcon className={`h-4 w-4 mr-2 ${parseError ? 'text-red-500' : 'text-orange-500'}`} /> 
                           {parseError ? 'Syntax Errors' : 'Schema Validation Errors'}
                        </span>
                        <Badge variant="destructive" className="ml-auto">{totalErrors}</Badge>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 px-1">
                    <div className="space-y-2">
                        {/* Map over unified displayableErrors */}
                        {displayableErrors.map((error, index) => {
                            // Render slightly differently for parse error vs schema error
                            if (error.isParseError) {
                                return (
                                    <div key={`parse-${index}`} className="py-2 px-3 border-l-4 border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20 rounded-r-md text-sm">
                                        <pre className="whitespace-pre-wrap break-words font-sans font-semibold">{error.message}</pre>
                                    </div>
                                );
                            } else if (error.rawError) {
                                return (
                                    // Pass only error and index, schemaData is removed
                                    <SchemaErrorItem key={`schema-${index}`} error={error.rawError} index={index} />
                                );
                            } else {
                                return null; // Should not happen
                            }
                        })}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

