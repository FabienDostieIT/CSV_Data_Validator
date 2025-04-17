"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast"
import CodeEditor from "@/components/code-editor"
import ThemeToggle from "@/components/theme-toggle"
import { useTheme } from "@/components/theme-provider"
import { Check, Copy, Download, FileText, Upload, Loader2, CheckCircle, XCircle, AlertTriangle, X, ChevronDown, Save, Info, Key, Hash, List, Type, Asterisk, Code2, ClipboardList } from "lucide-react"
import Papa from 'papaparse';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { cn } from "@/lib/utils";

// --- Custom Markdown Components for Styling ---
const CustomH1 = ({ node, ...props }: any) => <h1 className="text-2xl font-bold mt-6 mb-3 border-b pb-1" {...props} />;
const CustomH2 = ({ node, ...props }: any) => <h2 className="text-lg font-semibold mt-4 mb-2" {...props} />;
const CustomTable = ({ node, ...props }: any) => <table className="w-full my-3 border-collapse text-sm" {...props} />;
const CustomThead = ({ node, ...props }: any) => <thead className="hidden" {...props} />; // Hide default thead if simple key-value
const CustomTbody = ({ node, ...props }: any) => <tbody {...props} />;
const CustomTr = ({ node, ...props }: any) => <tr className="border-b border-muted/40" {...props} />;
const CustomTh = ({ node, ...props }: any) => <th className="p-2 text-left font-semibold w-1/4" {...props} />; // Key column
const CustomTd = ({ node, ...props }: any) => <td className="p-2 align-top" {...props} />; // Value column
const CustomCode = ({ node, ...props }: any) => <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono" {...props} />;
const CustomP = ({ node, ...props }: any) => <p className="mb-2 leading-relaxed" {...props} />;
const CustomHr = ({ node, ...props }: any) => <hr className="my-6 border-border" {...props} />;

// --- Modern Custom Markdown Components for Schema Doc Styling ---
const SchemaH1 = ({ node, ...props }: any) => (
  <h1 className="text-3xl font-extrabold mt-8 mb-4 flex items-center gap-2 text-gradient-to-r from-blue-600 to-purple-600">
    <ClipboardList className="h-6 w-6 text-blue-500" /> {props.children}
  </h1>
);
const SchemaH2 = ({ node, ...props }: any) => (
  <h2 className="text-xl font-bold mt-6 mb-2 flex items-center gap-2 text-purple-700 dark:text-purple-300">
    <Key className="h-5 w-5 text-purple-500" /> {props.children}
  </h2>
);
const SchemaTable = ({ node, ...props }: any) => (
  <table className="w-full my-3 border-separate border-spacing-y-1 text-sm bg-white/80 dark:bg-zinc-900/40 rounded-xl overflow-hidden shadow">
    {props.children}
  </table>
);
const SchemaTh = ({ node, ...props }: any) => (
  <th className="p-2 text-left font-semibold bg-blue-50 dark:bg-zinc-800 text-blue-900 dark:text-blue-200" {...props} />
);
const SchemaTd = ({ node, ...props }: any) => (
  <td className="p-2 align-top" {...props} />
);
const SchemaBlockquote = ({ node, ...props }: any) => (
  <blockquote className="border-l-4 border-blue-400 bg-blue-50/60 dark:bg-zinc-800/40 p-3 my-3 rounded-md text-blue-900 dark:text-blue-200 flex items-start gap-2">
    <Info className="h-5 w-5 text-blue-400 mt-0.5" />
    <span>{props.children}</span>
  </blockquote>
);
const SchemaCode = ({ node, ...props }: any) => (
  <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono text-blue-700 dark:text-blue-200" {...props} />
);
const SchemaP = ({ node, ...props }: any) => (
  <p className="mb-2 leading-relaxed text-zinc-700 dark:text-zinc-200" {...props} />
);

// --- Badge Renderer for Markdown (for enums, types, required, etc.) ---
const SchemaBadge = ({ children, color = "blue", icon }: any) => (
  <Badge className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-${color}-100 text-${color}-800 dark:bg-${color}-900/40 dark:text-${color}-200 mr-1 mb-1`}>
    {icon && React.createElement(icon, { className: "h-3 w-3 mr-0.5" })}
    {children}
  </Badge>
);

// Interface for a single validation issue (error or warning)
interface ValidationIssue {
    property: string;
    message: string;
}

// Interface for combined results per row
interface RowValidationResults {
    row: number;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
}

// Debounce utility
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function CsvValidator() {
    // --- State Variables --- // Uncomment most
    const [availableSchemaNames, setAvailableSchemaNames] = useState<string[]>([]); // List of schema filenames
    const [selectedSchemaName, setSelectedSchemaName] = useState<string>(""); // Currently selected filename
    const [selectedSchemaContent, setSelectedSchemaContent] = useState<any>(''); // Should ideally be parsed JSON object or string
    const [uploadedSchemaContent, setUploadedSchemaContent] = useState<any | null>(null); // State for uploaded schema content
    const [uploadedSchemaName, setUploadedSchemaName] = useState<string | null>(null); // State for uploaded schema name
    const [useUploadedSchema, setUseUploadedSchema] = useState<boolean>(false); // Flag for using uploaded schema
    const [csvRawText, setCsvRawText] = useState<string>("");
    const [csvData, setCsvData] = useState<Record<string, any>[]>([]);
    const [validationResults, setValidationResults] = useState<RowValidationResults[]>([]); // Updated state type
    const [totalErrorCount, setTotalErrorCount] = useState<number>(0);
    const [totalWarningCount, setTotalWarningCount] = useState<number>(0);
    const [visibleResultCount, setVisibleResultCount] = useState<number>(20); // State for visible results
    const [isLoadingSchemaList, setIsLoadingSchemaList] = useState<boolean>(true);
    const [isLoadingSchemaContent, setIsLoadingSchemaContent] = useState<boolean>(false);
    const [isValidatingCsv, setIsValidatingCsv] = useState<boolean>(false);
    const [isLoadingCsv, setIsLoadingCsv] = useState<boolean>(false);
    const [csvFileName, setCsvFileName] = useState<string>("");
    const [showFailureOverlay, setShowFailureOverlay] = useState<boolean>(false); 
    const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false); // Re-add simple overlay state
    const [overallCsvStatus, setOverallCsvStatus] = useState<'valid' | 'invalid' | 'pending' | 'error'>('pending');
    const [openAccordionValue, setOpenAccordionValue] = useState<string | undefined>(undefined); // State to track the open accordion item
    const [isJsonPanelVisible, setIsJsonPanelVisible] = useState<boolean>(false); // Keep one state for testing
    const [schemaMarkdown, setSchemaMarkdown] = useState<string>(''); // State for generated Markdown
    const [isFetchingMarkdown, setIsFetchingMarkdown] = useState<boolean>(false); // State for markdown fetch loading
    const [highlightedCsvLine, setHighlightedCsvLine] = useState<number | undefined>(undefined);
    const [scrollToLine, setScrollToLine] = useState<number | undefined>(undefined);

    // Uncomment Refs
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden CSV input
    const jsonInputRef = useRef<HTMLInputElement>(null); // Ref for hidden JSON input

    const { toast } = useToast();
    const { theme } = useTheme();

    const parentRef = useRef<HTMLDivElement>(null); // Ref for the *main* scrollable element

    // Derived state for displayed results
    const displayedResults = validationResults.slice(0, visibleResultCount);

    // Update Virtualizer configuration - Uncomment
    const rowVirtualizer = useVirtualizer({
        count: displayedResults.length, 
        getScrollElement: () => parentRef.current, 
        estimateSize: () => 50, 
        overscan: 5,
        // measureElement: (element) => {
        //      const trigger = element.querySelector('[data-state="closed"], [data-state="open"]'); 
        //      return trigger?.getBoundingClientRect().height || element.getBoundingClientRect().height;
        // }
    });

    useEffect(() => {
      if (validationResults.length > 0 && visibleResultCount < 20) {
        setVisibleResultCount(Math.min(20, validationResults.length));
      }
    }, [validationResults]);

    // --- Function to Fetch and Render Schema Docs --- // Moved definition *before* useEffect that needs it
    const fetchAndRenderSchemaDoc = useCallback(async (schemaOverride?: any) => {
        // Determine schema: use override if provided, otherwise use state
        const schemaToUse = schemaOverride
            ? schemaOverride
            : useUploadedSchema
                ? uploadedSchemaContent
                : selectedSchemaContent;

        // Proceed only if we have a schema to work with
        if (!schemaToUse || (typeof schemaToUse === 'string' && !schemaToUse.trim())) {
            setSchemaMarkdown(''); // Clear if no schema
            setIsFetchingMarkdown(false); // Finish loading
            return;
        }

        setIsFetchingMarkdown(true); // Indicate loading
        setSchemaMarkdown(''); // Clear previous content

        try {
            // Parse the schema if it's a string (from pre-loaded), otherwise use the object (uploaded)
            const schemaObject = typeof schemaToUse === 'string' ? JSON.parse(schemaToUse) : schemaToUse;

            const response = await fetch('/api/generate-schema-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schema: schemaObject })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to get error details
                throw new Error(`Failed to fetch schema documentation: ${response.statusText} ${errorData.details ? `(${errorData.details})` : ''}`);
            }

            const result = await response.json();
            setSchemaMarkdown(result.markdown);

        } catch (error: any) {
            console.error("Failed to fetch/generate schema docs:", error);
            toast({ title: "Error", description: `Could not generate schema documentation: ${error.message}`, variant: "destructive" });
            setSchemaMarkdown('# Error generating documentation'); // Show error in panel
        } finally {
            setIsFetchingMarkdown(false); // Finish loading
        }
    }, [selectedSchemaContent, uploadedSchemaContent, useUploadedSchema, toast]); // Dependencies for fetching (toast added)

    // --- Effect to fetch schema list on mount --- // Keep uncommented for now
    useEffect(() => {
      const fetchSchemaList = async () => {
        setIsLoadingSchemaList(true);
        try {
          const response = await fetch('/api/schemas');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          if (data.schemas && Array.isArray(data.schemas)) {
            setAvailableSchemaNames(data.schemas);
            // Select the first schema by default if list is not empty
            if (data.schemas.length > 0) {
              setSelectedSchemaName(data.schemas[0]);
            } else {
              setSelectedSchemaContent("// No schemas found in directory.");
            }
          } else {
            throw new Error("Invalid response format from /api/schemas");
          }
        } catch (error) {
          console.error("Failed to fetch schema list:", error);
          toast({ title: "Error", description: "Could not load schema list.", variant: "destructive" });
          setSelectedSchemaContent("// Error loading schema list.");
        } finally {
          setIsLoadingSchemaList(false);
        }
      };
      fetchSchemaList();
    }, [toast]); // Add toast dependency

    // --- Effect to fetch schema content when selection changes --- // Uncomment
    useEffect(() => {
      if (!selectedSchemaName && !useUploadedSchema) { // Adjusted condition
          setSelectedSchemaContent('');
          setSchemaMarkdown(''); // Clear markdown when schema is unselected/cleared
          return;
      }

      const fetchSchemaContent = async () => {
        setIsLoadingSchemaContent(true);
        // Don't clear markdown here, let fetchAndRender handle it
        // setSchemaMarkdown(''); 
        try {
          const response = await fetch(`/api/schemas/${selectedSchemaName}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          const newSchemaContent = data.content; // Store fetched content
          setSelectedSchemaContent(newSchemaContent); // Update state for editor
          toast({ title: "Success", description: `Schema '${selectedSchemaName}' loaded.` });
          setIsLoadingSchemaContent(false);
          
          // If panel is visible, refresh the doc content now
          if (isJsonPanelVisible) {
              console.log("fetchSchemaContent: Panel visible, triggering doc refresh");
              // Pass the newly fetched content directly to avoid state delay issues
              fetchAndRenderSchemaDoc(newSchemaContent); 
          }

        } catch (error) {
          console.error("Error fetching schema content:", error);
          toast({ variant: "destructive", title: "Error", description: `Failed to load schema '${selectedSchemaName}'.` });
          setSelectedSchemaContent('');
          setIsLoadingSchemaContent(false);
          setSchemaMarkdown(''); // Clear markdown on error
        }
      };

      if (!useUploadedSchema && selectedSchemaName) { // Only fetch pre-defined if not using uploaded
          fetchSchemaContent();
      } else if (useUploadedSchema && uploadedSchemaContent) {
          // If using uploaded schema, set its content directly
          const newSchemaContent = JSON.stringify(uploadedSchemaContent, null, 2);
          setSelectedSchemaContent(newSchemaContent);
          setIsLoadingSchemaContent(false);
          // If panel is visible, refresh the doc content now
           if (isJsonPanelVisible) {
              console.log("useEffect[uploaded]: Panel visible, triggering doc refresh");
              // Pass the uploaded object directly
              fetchAndRenderSchemaDoc(uploadedSchemaContent); 
           }
      } else {
           // Handle cases where selection is cleared or invalid
            setSelectedSchemaContent('');
            setIsLoadingSchemaContent(false);
            setSchemaMarkdown(''); // Clear markdown
            // If panel was visible, clear it too
            // The fetchAndRenderSchemaDoc call below handles clearing implicitly
       }
     }, [selectedSchemaName, useUploadedSchema, uploadedSchemaContent, toast, isJsonPanelVisible, fetchAndRenderSchemaDoc]); // Added isJsonPanelVisible & fetchAndRenderSchemaDoc

    // --- Handlers --- // Uncomment all
    const handleSchemaSelectionChange = (schemaName: string) => {
      if (schemaName === 'uploaded-schema' && uploadedSchemaContent) {
          setUseUploadedSchema(true);
          setSelectedSchemaName(uploadedSchemaName || 'uploaded-schema'); // Keep track
          // Directly use uploaded content (handled in useEffect now)
      } else if (schemaName && schemaName !== 'uploaded-schema') {
          setUseUploadedSchema(false);
          setSelectedSchemaName(schemaName);
          // Fetching handled by useEffect
      }
    };

    const handleCsvUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setIsLoadingCsv(true);
      setCsvFileName(file.name);
      setOverallCsvStatus('pending'); // Reset status
      toast({ title: "Parsing CSV", description: `Processing ${file.name}...` });

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvRawText(text);

        Papa.parse<Record<string, any>>(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true, // changed from false
          complete: (results) => {
            // Check for Papa Parse errors specifically
            if (results.errors.length > 0) {
              console.error('CSV Parsing Errors:', results.errors);
              // Add null checks for the first error object
              const firstError = results.errors[0];
              // Use nullish coalescing for defaults. Add 1 to row index.
              const errorRow = (firstError?.row ?? -1) + 1; 
              const errorMessage = firstError?.message ?? 'Unknown parsing error';
              setValidationResults([
                {
                  row: errorRow, // Use checked/defaulted row
                  // Use errorRow in the path string as well
                  errors: [
                    {
                      property: `CSV Header/Parse Error (Row ${errorRow})`,
                      message: errorMessage, // Use checked/defaulted message
                    },
                  ],
                  warnings: [],
                },
              ]);
              setCsvData([]);
              setOverallCsvStatus('invalid');
            } else {
              setCsvData(results.data); // Keep this, worker will handle typing
              setOverallCsvStatus('pending'); // Set to pending as validation hasn't run
              // Optionally trigger validation immediately after upload
              // performCsvValidation(results.data, selectedSchemaContent);
            }
            setIsLoadingCsv(false);
          },
          error: (error: Error) => {
            console.error('CSV Parsing Failed:', error);
            setValidationResults([
              {
                row: 0,
                errors: [
                  {
                    property: 'CSV Parsing Failed',
                    message: error.message,
                  },
                ],
                warnings: [],
              },
            ]);
            setCsvData([]);
            setOverallCsvStatus('error');
            setIsLoadingCsv(false);
          },
        });
      };
      reader.readAsText(file);
    }, [toast]); // Add toast dependency if used inside

    const handleSaveCsv = () => {
      if (!csvRawText.trim()) {
          toast({ variant: "destructive", title: "Error", description: "No CSV data to save." });
          return;
      }

      try {
          // --- Save Logic --- 
          const blob = new Blob([csvRawText], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          const filename = csvFileName || "edited_data.csv";
          link.setAttribute("download", filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url); 
          toast({ title: "CSV Saved", description: `Saved data as ${filename}` });
          
          // --- Re-parse and Re-validate (Immediately) --- 
          console.log("Re-parsing and validating after save...");
          const parseResult = Papa.parse<Record<string, any>>(csvRawText, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true, // changed from false
          });

          if (parseResult.errors.length > 0) {
              console.error('CSV Re-Parsing Errors after save:', parseResult.errors);
              const firstError = parseResult.errors[0];
              const errorMessage = firstError?.message ?? 'Unknown parsing error';
              toast({ variant: "destructive", title: "CSV Parse Error", description: `Could not re-validate after save due to parsing errors: ${errorMessage}` });
              setOverallCsvStatus('error');
              // Reset overlays here too in case of parse error preventing validation
              setShowSuccessOverlay(false);
              setShowFailureOverlay(false);
          } else {
              setCsvData(parseResult.data); 
              // Directly call validation
              performCsvValidation(parseResult.data);
          }

      } catch (error) {
           console.error("Error saving or re-parsing CSV:", error);
           toast({ variant: "destructive", title: "Save/Validation Error", description: "Could not save or re-validate CSV data." });
      }
  };

  const handleCsvDownload = () => {
      // This might now be redundant if handleSaveCsv does what's needed?
      // Or keep it as a way to download the *original* uploaded data if needed?
      // For now, let's point it to the save function.
      handleSaveCsv(); 
      // Original placeholder: 
      // console.log("TODO: Implement CSV Download");
      // toast({ title: "Info", description: "CSV Download not implemented yet." });
  };

    const handleUploadClick = () => {
      fileInputRef.current?.click(); // Trigger click on hidden input
    };

    const handleUploadSchemaClick = () => {
      jsonInputRef.current?.click(); // Trigger click on hidden JSON input
    };

    const handleSchemaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const parsedJson = JSON.parse(text);
          // Basic check if it looks like a schema
          if (typeof parsedJson !== 'object' || parsedJson === null || !parsedJson.$schema) {
              throw new Error('Invalid JSON content or missing $schema keyword.');
          }
          
          setUploadedSchemaContent(parsedJson);
          setUploadedSchemaName(file.name);
          setSelectedSchemaContent(text); // Update editor view
          setUseUploadedSchema(true);
          setOverallCsvStatus('pending');
          toast({ title: "Schema Uploaded", description: `Using uploaded schema: ${file.name}` });

        } catch (error: any) {
          console.error("Failed to parse uploaded JSON schema:", error);
          toast({ variant: "destructive", title: "Schema Upload Error", description: `Failed to parse JSON file: ${error.message}` });
          // Reset state if upload fails
          setUploadedSchemaContent(null);
          setUploadedSchemaName(null);
          setUseUploadedSchema(false);
        }
      };
      reader.onerror = (error) => {
          console.error("Failed to read uploaded file:", error);
          toast({ variant: "destructive", title: "File Read Error", description: "Could not read the selected file." });
      };
      reader.readAsText(file);

      // Reset the file input
      if (event.target) {
          event.target.value = '';
      }
    };

    const handleClearUploadedSchema = useCallback(async () => {
      setUploadedSchemaContent(null);
      setUploadedSchemaName(null);
      setUseUploadedSchema(false);
      
      // Reset editor to the content of the currently selected dropdown schema
      if (selectedSchemaName) {
          setIsLoadingSchemaContent(true); // Show loading indicator briefly
          try {
              const response = await fetch(`/api/schemas/${selectedSchemaName}`);
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const data = await response.json();
              setSelectedSchemaContent(data.content);
              toast({ title: "Schema Cleared", description: `Restored schema: ${selectedSchemaName}` });
          } catch (error) {
              console.error("Error re-fetching schema content:", error);
              toast({ variant: "destructive", title: "Error", description: `Failed to restore schema '${selectedSchemaName}'.` });
              setSelectedSchemaContent('// Error loading schema.');
          }
          setIsLoadingSchemaContent(false);
      } else {
          setSelectedSchemaContent('// Select a schema or upload one.'); // Handle case where no dropdown schema was selected
          toast({ title: "Schema Cleared" });
      }

  }, [selectedSchemaName, toast]); // Add dependencies

    const performCsvValidation = useCallback(async (dataOverride?: Record<string, any>[]) => {
      setIsValidatingCsv(true);
      setOverallCsvStatus('pending');
      setTotalErrorCount(0);
      setTotalWarningCount(0);
      setVisibleResultCount(20);

      // Determine the schema to use
      let schemaToUse;
      let schemaIdentifier;
      if (useUploadedSchema && uploadedSchemaContent) {
        schemaToUse = uploadedSchemaContent;
        schemaIdentifier = uploadedSchemaName || 'Uploaded Schema';
      } else if (!useUploadedSchema && selectedSchemaContent) {
        try {
          schemaToUse = typeof selectedSchemaContent === 'string' ? JSON.parse(selectedSchemaContent) : selectedSchemaContent;
        } catch (parseError) {
          toast({ title: "Schema Error", description: "The selected schema is not valid JSON.", variant: "destructive" });
          setIsValidatingCsv(false);
          return;
        }
        schemaIdentifier = selectedSchemaName || 'Selected Schema';
      } else {
        toast({ title: "Error", description: "Please select or upload a schema first.", variant: "destructive" });
        setIsValidatingCsv(false);
        return;
      }

      const dataToValidate = dataOverride ?? csvData;
      if (!dataToValidate || dataToValidate.length === 0) {
        setIsValidatingCsv(false);
        setOverallCsvStatus('pending');
        return;
      }

      // AJV setup
      const ajv = new Ajv({ allErrors: true });
      addFormats(ajv);
      let validate;
      try {
        validate = ajv.compile(schemaToUse);
      } catch (e) {
        toast({ title: "Schema Compile Error", description: (e instanceof Error ? e.message : String(e)), variant: "destructive" });
        setIsValidatingCsv(false);
        setOverallCsvStatus('error');
        return;
      }

      let results: RowValidationResults[] = [];
      let totalErrors = 0;
      let totalWarnings = 0;

      for (let i = 0; i < dataToValidate.length; i++) {
        const row = dataToValidate[i];
        let valid = true;
        let errors: ValidationIssue[] = [];
        let warnings: ValidationIssue[] = [];
        try {
          valid = validate(row);
        } catch (e) {
          valid = false;
          errors.push({ property: 'Row', message: (e instanceof Error ? e.message : String(e)) });
        }
        if (!valid && validate.errors) {
          validate.errors.forEach(err => {
            const property = err.instancePath ? err.instancePath.replace(/^\//, '') : 'Row';
            let value = property && row && row[property] !== undefined ? row[property] : undefined;
            let message = err.message || 'Validation error';
            if (err.keyword === 'enum' && err.params?.allowedValues) {
              message = `Value '${value}' is not valid for '${property}'. Allowed values: [${err.params.allowedValues.join(', ')}]`;
            } else if (err.keyword === 'type' && err.params?.type) {
              message = `Value '${value}' for '${property}' is not of type '${err.params.type}'.`;
            } else if (err.keyword === 'required' && err.params?.missingProperty) {
              message = `Missing required property '${err.params.missingProperty}'.`;
            } else if (err.keyword === 'pattern' && err.params?.pattern) {
              message = `Value '${value}' for '${property}' does not match required pattern: ${err.params.pattern}`;
            } else if (err.keyword === 'additionalProperties' && err.params?.additionalProperty) {
              message = `Unexpected property '${err.params.additionalProperty}' found.`;
            } else if (value !== undefined) {
              message = `${message} (Value: '${value}')`;
            }
            if (err.keyword === 'additionalProperties') {
              warnings.push({ property, message });
              totalWarnings++;
            } else {
              errors.push({ property, message });
              totalErrors++;
            }
          });
        }
        if (errors.length > 0 || warnings.length > 0) {
          results.push({ row: i, errors, warnings });
        }
      }

      setValidationResults(results);
      setTotalErrorCount(totalErrors);
      setTotalWarningCount(totalWarnings);
      setVisibleResultCount(Math.min(20, results.length));
      setOverallCsvStatus(totalErrors === 0 ? 'valid' : 'invalid');
      setIsValidatingCsv(false);

      if (totalErrors === 0) {
        toast({ title: "Validation Successful", description: "CSV data conforms to the selected schema." });
      } else {
        toast({ variant: "destructive", title: "Validation Failed", description: `Found ${totalErrors} error(s) in the CSV data. See results below.` });
      }
    }, [csvData, selectedSchemaContent, uploadedSchemaContent, useUploadedSchema, selectedSchemaName, uploadedSchemaName, toast]);

    const handleCopySchema = () => {
      navigator.clipboard.writeText(selectedSchemaContent).then(() => {
        toast({ title: "Schema Copied!", description: "Schema content copied to clipboard." });
      }, (err) => {
        toast({ title: "Copy Failed", description: "Could not copy schema.", variant: "destructive" });
      });
    };

    const handleClearCsv = useCallback(() => {
      setCsvRawText('');
      setCsvData([]);
      setCsvFileName('');
      setOverallCsvStatus('pending'); // Reset status
      // Reset the file input so the same file can be re-uploaded if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTotalErrorCount(0);
      setTotalWarningCount(0);
      setVisibleResultCount(20); // Reset on clear
      setShowSuccessOverlay(false); 
      setShowFailureOverlay(false);
      toast({ title: "Info", description: "CSV data cleared." });
    }, [toast]);

    const getStatusIcon = (status: 'valid' | 'invalid' | 'pending' | 'error') => {
      switch (status) {
        case 'valid': return <CheckCircle className="h-5 w-5 text-green-500" />;
        case 'invalid': return <XCircle className="h-5 w-5 text-red-500" />;
        case 'error': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
        case 'pending':
        default: return <FileText className="h-5 w-5 text-gray-400" />;
      }
    };

    const handleCopyResults = () => {
      // Include warnings in copied results
      const resultsText = JSON.stringify(validationResults, null, 2);
      navigator.clipboard.writeText(resultsText).then(() => {
        toast({ title: "Results Copied!", description: "Validation results (errors and warnings) copied to clipboard." });
      }, (err) => {
        toast({ title: "Copy Failed", description: "Could not copy results.", variant: "destructive" });
      });
    };

    const handleShowMoreResults = () => {
      setVisibleResultCount(prev => Math.min(prev + 20, validationResults.length));
    };

    // --- Handler to Toggle JSON Panel --- // Updated to use fetchAndRenderSchemaDoc
    const toggleJsonPanel = async () => {
        if (isJsonPanelVisible) {
            setIsJsonPanelVisible(false);
        } else {
            await fetchAndRenderSchemaDoc(); // Fetch/render
            setIsJsonPanelVisible(true);    // Then show
        }
    };

    useEffect(() => {
      if (validationResults.length > 0 && visibleResultCount < 20) {
        setVisibleResultCount(Math.max(10, Math.min(20, validationResults.length)));
      }
    }, [validationResults]);

    // Live validation effect
    useEffect(() => {
      if (!csvRawText.trim()) {
        setCsvData([]);
        setOverallCsvStatus('pending');
        setTotalErrorCount(0);
        setTotalWarningCount(0);
        setVisibleResultCount(20);
        return;
      }
      // Debounced parse and validate
      const debounced = debounce(() => {
        const parseResult = Papa.parse<Record<string, any>>(csvRawText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true, // changed from false
        });
        if (parseResult.errors.length > 0) {
          setCsvData([]);
          setValidationResults([
            {
              row: (parseResult.errors[0]?.row ?? -1) + 1,
              errors: [{ property: `CSV Header/Parse Error (Row ${(parseResult.errors[0]?.row ?? -1) + 1})`, message: parseResult.errors[0]?.message ?? 'Unknown parsing error' }],
              warnings: [],
            },
          ]);
          setOverallCsvStatus('invalid');
          setTotalErrorCount(1);
          setTotalWarningCount(0);
          setVisibleResultCount(1);
        } else {
          setCsvData(parseResult.data);
          performCsvValidation(parseResult.data); // Always validate the latest parsed data
        }
      }, 400); // 400ms debounce
      debounced();
      // Cleanup
      return () => { clearTimeout((debounced as any).timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [csvRawText, selectedSchemaContent, uploadedSchemaContent, useUploadedSchema]);

    return (
      <div className="flex flex-col h-screen w-full">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e007d]/10 dark:border-zinc-700 flex-shrink-0">
           <div className="flex items-center gap-2">
             <img
               src="/lavitrine_logo.svg"
               alt="Company Logo"
               className="h-16 w-auto transition-all duration-300 dark:filter dark:invert dark:brightness-0 dark:contrast-100"
             />
             <span className="text-sm font-medium text-muted-foreground">|</span>
             <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
               CSV Data Validator
             </h1>
           </div>
           <div className="flex items-center gap-2">
             <ThemeToggle />
           </div>
        </header>

        <section className="px-6 py-4 flex flex-wrap gap-4 items-center border-b border-[#1e007d]/10 dark:border-zinc-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Schema:</span>
               <Select
                   value={useUploadedSchema ? 'uploaded-schema' : selectedSchemaName} // Ensure value reflects uploaded state
                   onValueChange={handleSchemaSelectionChange}
                   disabled={isLoadingSchemaList || availableSchemaNames.length === 0}
               >
                 <SelectTrigger className="w-[220px] bg-background border-[#1e007d]/20 dark:border-zinc-700">
                   <SelectValue placeholder={isLoadingSchemaList ? "Loading..." : "Select Schema"} />
                 </SelectTrigger>
                 <SelectContent className="dark:bg-zinc-800">
                   {isLoadingSchemaList ? (
                       <SelectItem value="loading" disabled>Loading...</SelectItem>
                   ) : availableSchemaNames.length === 0 && !uploadedSchemaName ? (
                       <SelectItem value="no-schemas" disabled>No schemas found</SelectItem>
                   ) : null}
                   {availableSchemaNames.map((name) => (
                       <SelectItem key={name} value={name} className="dark:focus:bg-zinc-700">
                         {name}
                       </SelectItem>
                   ))}
                   {uploadedSchemaContent && (
                        <SelectItem value="uploaded-schema" className="dark:focus:bg-zinc-700">
                           {uploadedSchemaName || "Uploaded Schema"}
                        </SelectItem>
                    )}
                 </SelectContent>
               </Select>
           </div>

            <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
               <Button variant="outline" size="sm" onClick={handleUploadSchemaClick} className="border-[#1e007d]/20 dark:border-zinc-700">
                   <Upload className="h-4 w-4 mr-2" /> Upload Schema
               </Button>
           </TooltipTrigger> <TooltipContent side="bottom"><p>Upload Custom Schema (.json)</p></TooltipContent> </Tooltip> </TooltipProvider>

           {useUploadedSchema && (
               <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                   <Button variant="outline" size="sm" onClick={handleClearUploadedSchema} className="text-destructive hover:bg-destructive/10 border-destructive/50">
                       <X className="h-4 w-4 mr-2" /> Clear Uploaded
                   </Button>
               </TooltipTrigger> <TooltipContent side="bottom"><p>Clear Uploaded Schema</p></TooltipContent> </Tooltip> </TooltipProvider>
           )}

           <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
               <Button
                   variant="outline"
                   size="sm"
                   onClick={toggleJsonPanel}
                   disabled={isLoadingSchemaContent || isFetchingMarkdown || (!selectedSchemaName && !useUploadedSchema)}
                   className="border-[#1e007d]/20 dark:border-zinc-700"
               >
                   {isFetchingMarkdown ? (
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   ) : null}
                   {isJsonPanelVisible ? "Hide Schema View" : "Show Schema View"}
               </Button>
           </TooltipTrigger> <TooltipContent side="bottom"><p>{isJsonPanelVisible ? "Hide human-readable schema" : "Show human-readable schema"}</p></TooltipContent> </Tooltip> </TooltipProvider>

           <div className="flex-grow"></div>

            <Button
               onClick={() => performCsvValidation()}
               disabled={isValidatingCsv || !csvRawText.trim() || (!selectedSchemaName && !useUploadedSchema)}
               size="sm"
               className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
             >
               {isValidatingCsv ? (
                 <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</>
               ) : (
                 "Validate Data"
               )}
             </Button>

        </section>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 pt-6 pb-4" style={{height: 'calc(100vh - 112px - 72px)'}}>
          {isJsonPanelVisible ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex flex-row gap-6 flex-1 min-h-0 transition-all duration-[4500ms] ease-[cubic-bezier(0.77,0,0.175,1)]" style={{height: '66%'}}>
                {/* Schema panel */}
                <div className="w-1/2 min-w-0 flex flex-col h-full overflow-hidden">
                  <Card className="flex-1 min-h-0 flex flex-col h-full border-[#1e007d]/20 dark:border-zinc-700 shadow-md dark:shadow-zinc-900/50 rounded-lg">
                     <CardHeader className="flex-shrink-0 p-3 border-b border-[#1e007d]/10 dark:border-zinc-600">
                         <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">Schema Documentation</CardTitle>
                     </CardHeader>
                     <CardContent className="flex-1 overflow-y-auto p-4">
                         {isFetchingMarkdown ? (
                              <div className="flex justify-center items-center h-full text-muted-foreground">
                                  <Loader2 className="h-6 w-6 animate-spin" />
                              </div>
                         ) : schemaMarkdown ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                 <ReactMarkdown
                                     remarkPlugins={[remarkGfm]}
                                     rehypePlugins={[rehypeRaw]}
                                     components={{
                                          h1: SchemaH1,
                                          h2: SchemaH2,
                                          p: SchemaP,
                                          table: SchemaTable,
                                          th: SchemaTh,
                                          td: SchemaTd,
                                          blockquote: SchemaBlockquote,
                                          code: SchemaCode,
                                          // Optionally: render badges for enums/types/required
                                          // You can further enhance by parsing inline code or custom syntax for badges
                                     }}
                                 >
                                    {schemaMarkdown}
                                </ReactMarkdown>
                             </div>
                         ) : (
                              <div className="flex items-center justify-center h-full text-center text-muted-foreground p-4">
                                 {(!selectedSchemaName && !useUploadedSchema)
                                    ? "Select or upload a schema."
                                    : "Click \"Show Schema Doc\" to generate documentation."
                                 }
                              </div>
                         )}
                     </CardContent>
                  </Card>
                </div>
                {/* CSV panel */}
                <div className="w-1/2 min-w-0 flex flex-col h-full overflow-hidden">
                  <Card className="flex-1 min-h-0 flex flex-col h-full border-[#1e007d]/20 dark:border-zinc-700 shadow-md dark:shadow-zinc-900/50 rounded-lg">
                     <CardHeader className="flex-row justify-between items-center p-3 border-b border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                          <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">CSV Data</CardTitle>
                          {csvFileName && <span className="text-xs text-muted-foreground truncate">({csvFileName})</span>}
                        </div>
                        <div className="flex items-center space-x-1">
                           <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={(e) => { e.stopPropagation(); handleSaveCsv(); }}
                               className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8"
                               disabled={!csvRawText.trim()} 
                             >
                                 <Save className="h-4 w-4" />
                             </Button>
                           </TooltipTrigger> <TooltipContent side="bottom"><p>Save Edited CSV</p></TooltipContent> </Tooltip> </TooltipProvider>
                           {csvRawText.trim() && (
                              <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleClearCsv(); }} className="hover:bg-destructive/10 text-destructive h-8 w-8">
                                      <X className="h-4 w-4" />
                                  </Button>
                              </TooltipTrigger> <TooltipContent side="bottom"><p>Clear CSV Data</p></TooltipContent> </Tooltip> </TooltipProvider>
                           )}
                        </div>
                      </CardHeader>

                      <div className="flex flex-col items-center justify-center px-6 pt-6 pb-2">
                        {csvFileName ? (
                          <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={isLoadingSchemaContent || isValidatingCsv || isLoadingCsv}
                            className={`w-12 h-12 flex items-center justify-center rounded-xl border-2 border-dashed border-[#1e007d]/30 dark:border-zinc-600 bg-white/60 dark:bg-zinc-900/40 shadow-sm hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed ${csvFileName ? 'border-green-400 bg-green-50/60 dark:bg-green-900/20' : ''}`}
                            tabIndex={0}
                            aria-label="Upload another CSV file"
                          >
                            <Upload className="h-7 w-7 text-[#1e007d] dark:text-blue-300" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={isLoadingSchemaContent || isValidatingCsv || isLoadingCsv}
                            className={`w-full max-w-md flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#1e007d]/30 dark:border-zinc-600 bg-white/60 dark:bg-zinc-900/40 py-6 shadow-sm hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed`}
                            tabIndex={0}
                          >
                            <span className="text-lg font-medium text-[#1e007d] dark:text-blue-200 mb-2">
                              Please upload your CSV here
                            </span>
                            <Upload className="h-7 w-7 text-[#1e007d] dark:text-blue-300 mb-2" />
                            <span className="text-xs text-muted-foreground mt-2">Accepted: .csv</span>
                          </button>
                        )}
                      </div>

                      <CardContent className="flex-grow p-0 relative min-h-0 overflow-auto">
                        <CodeEditor
                          value={csvRawText}
                          language="csv"
                          readOnly={false}
                          height="100%"
                          onChange={setCsvRawText}
                          highlightedLine={highlightedCsvLine}
                          scrollToLine={scrollToLine}
                        />
                      </CardContent>
                  </Card>
                </div>
              </div>
              <div className="h-4 flex-shrink-0" />
              <div className="w-full min-h-0 flex flex-col flex-shrink-0" style={{height: '34%'}}>
                <Card className="h-full flex flex-col border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg overflow-hidden">
                   <CardHeader className="flex flex-row items-center justify-between bg-[#1e007d]/5 dark:bg-zinc-800/50 p-3 border-b border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0">
                         <div className="flex items-center space-x-4">
                           {overallCsvStatus === 'valid' ? (
                             <CheckCircle className="h-5 w-5 text-green-500" />
                           ) : overallCsvStatus === 'invalid' ? (
                             <XCircle className="h-5 w-5 text-red-500" />
                           ) : overallCsvStatus === 'pending' ? (
                             <FileText className="h-5 w-5 text-gray-400" />
                           ) : (
                             <AlertTriangle className="h-5 w-5 text-yellow-500" />
                           )}
                           <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">Validation Results</CardTitle>
                           {(totalErrorCount > 0 || totalWarningCount > 0) && (
                               <span className="text-lg text-muted-foreground font-bold">
                                   ({totalErrorCount > 0 ? `${totalErrorCount} Errors` : ''}
                                   {totalErrorCount > 0 && totalWarningCount > 0 ? ', ' : ''}
                                   {totalWarningCount > 0 ? `${totalWarningCount} Warnings` : ''})
                               </span>
                           )}
                         </div>
                         <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={handleCopyResults} disabled={validationResults.length === 0} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8">
                             <Copy className="h-4 w-4" />
                           </Button>
                         </TooltipTrigger> <TooltipContent side="bottom"><p>Copy Results</p></TooltipContent> </Tooltip> </TooltipProvider>
                     </CardHeader>
                     <ScrollArea className="h-full" type="auto"> 
                         <CardContent className="p-0 h-full overflow-auto">
                           <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                             {displayedResults.length === 0 && !isValidatingCsv && (
                               <div className="flex items-center justify-center p-10 text-muted-foreground">
                                 {overallCsvStatus === 'pending' ? 'Upload CSV and click Validate.' : 'No issues found.'}
                               </div>
                             )}
                             {isValidatingCsv && (
                               <div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</div>
                             )}
                             {displayedResults.length > 0 && displayedResults.map((result, idx) => {
                               const rowSeverity = result.errors.length > 0 ? 'error' : 'warning';
                               return (
                                 <Accordion
                                   key={result.row}
                                   type="single"
                                   collapsible
                                   className="w-full border-b border-muted/20 px-4"
                                   value={openAccordionValue}
                                   onValueChange={(val) => {
                                     setOpenAccordionValue(val);
                                     if (val && val.startsWith('item-')) {
                                       const rowIdx = parseInt(val.replace('item-', ''), 10);
                                       setHighlightedCsvLine(rowIdx + 2);
                                       setScrollToLine(rowIdx + 2);
                                     } else {
                                       setHighlightedCsvLine(undefined);
                                       setScrollToLine(undefined);
                                     }
                                   }}
                                 >
                                   <AccordionItem
                                     value={`item-${result.row}`}
                                     className="border-b-0"
                                   >
                                     <AccordionTrigger className={cn(
                                       "text-sm text-left hover:no-underline py-2 group flex items-center",
                                       rowSeverity === 'error'
                                         ? 'data-[state=open]:text-red-700 dark:data-[state=open]:text-red-300'
                                         : 'data-[state=open]:text-yellow-700 dark:data-[state=open]:text-yellow-300'
                                     )}> 
                                       <div className="flex items-center space-x-2 flex-grow truncate">
                                         {rowSeverity === 'error' ?
                                           <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" /> :
                                           <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                                         <span className="font-semibold">Row {result.row + 2}:</span>
                                         <span className="truncate flex-grow text-muted-foreground">
                                           {result.errors[0]?.message || result.warnings[0]?.message || 'Unknown issue'}
                                           {(result.errors.length + result.warnings.length) > 1 ? ` (+${result.errors.length + result.warnings.length - 1} more)` : ''}
                                         </span>
                                       </div>
                                       <ChevronDown className={cn(
                                         "h-4 w-4 ml-2 transition-transform duration-200",
                                         openAccordionValue === `item-${result.row}` ? 'rotate-180' : ''
                                       )} />
                                     </AccordionTrigger>
                                     <AccordionContent className="text-xs px-4 pt-2 pb-3 space-y-1 bg-muted/30 rounded-b">
                                       {result.errors.map((err, index) => (
                                         <div key={`err-${index}`} className="flex items-start text-red-600 dark:text-red-400">
                                           <XCircle className="h-3 w-3 mr-1.5 mt-0.5 flex-shrink-0" />
                                           <div>
                                             <span className="font-semibold">Error:</span> <span className="font-medium">{err.property || 'N/A'}</span> - {err.message}
                                           </div>
                                         </div>
                                       ))}
                                       {result.warnings.map((warn, index) => (
                                         <div key={`warn-${index}`} className="flex items-start text-yellow-600 dark:text-yellow-400">
                                           <AlertTriangle className="h-3 w-3 mr-1.5 mt-0.5 flex-shrink-0" />
                                           <div>
                                             <span className="font-semibold">Warning:</span> <span className="font-medium">{warn.property || 'N/A'}</span> - {warn.message}
                                           </div>
                                         </div>
                                       ))}
                                     </AccordionContent>
                                   </AccordionItem>
                                 </Accordion>
                               );
                             })}
                           </div>
                         </CardContent>
                         {validationResults.length > visibleResultCount && (
                             <CardFooter className="p-3 border-t border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0 justify-center">
                                 <Button
                                     variant="secondary"
                                     onClick={handleShowMoreResults}
                                     disabled={isValidatingCsv}
                                 >
                                     Show More Results ({displayedResults.length} / {validationResults.length})
                                 </Button>
                             </CardFooter>
                         )}
                     </ScrollArea> 
                </Card>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{height: '66%'}}>
                <Card className="flex-1 min-h-0 flex flex-col h-full border-[#1e007d]/20 dark:border-zinc-700 shadow-md dark:shadow-zinc-900/50 rounded-lg">
                   <CardHeader className="flex-row justify-between items-center p-3 border-b border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                        <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">CSV Data</CardTitle>
                        {csvFileName && <span className="text-xs text-muted-foreground truncate">({csvFileName})</span>}
                      </div>
                      <div className="flex items-center space-x-1">
                         <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={(e) => { e.stopPropagation(); handleSaveCsv(); }}
                             className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8"
                             disabled={!csvRawText.trim()} 
                           >
                               <Save className="h-4 w-4" />
                           </Button>
                         </TooltipTrigger> <TooltipContent side="bottom"><p>Save Edited CSV</p></TooltipContent> </Tooltip> </TooltipProvider>
                         {csvRawText.trim() && (
                            <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleClearCsv(); }} className="hover:bg-destructive/10 text-destructive h-8 w-8">
                                    <X className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger> <TooltipContent side="bottom"><p>Clear CSV Data</p></TooltipContent> </Tooltip> </TooltipProvider>
                         )}
                      </div>
                    </CardHeader>

                    <div className="flex flex-col items-center justify-center px-6 pt-6 pb-2">
                      {csvFileName ? (
                        <button
                          type="button"
                          onClick={handleUploadClick}
                          disabled={isLoadingSchemaContent || isValidatingCsv || isLoadingCsv}
                          className={`w-12 h-12 flex items-center justify-center rounded-xl border-2 border-dashed border-[#1e007d]/30 dark:border-zinc-600 bg-white/60 dark:bg-zinc-900/40 shadow-sm hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed ${csvFileName ? 'border-green-400 bg-green-50/60 dark:bg-green-900/20' : ''}`}
                          tabIndex={0}
                          aria-label="Upload another CSV file"
                        >
                          <Upload className="h-7 w-7 text-[#1e007d] dark:text-blue-300" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleUploadClick}
                          disabled={isLoadingSchemaContent || isValidatingCsv || isLoadingCsv}
                          className={`w-full max-w-md flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#1e007d]/30 dark:border-zinc-600 bg-white/60 dark:bg-zinc-900/40 py-6 shadow-sm hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed`}
                          tabIndex={0}
                        >
                          <span className="text-lg font-medium text-[#1e007d] dark:text-blue-200 mb-2">
                            Please upload your CSV here
                          </span>
                          <Upload className="h-7 w-7 text-[#1e007d] dark:text-blue-300 mb-2" />
                          <span className="text-xs text-muted-foreground mt-2">Accepted: .csv</span>
                        </button>
                      )}
                    </div>

                    <CardContent className="flex-grow p-0 relative min-h-0 overflow-auto">
                      <CodeEditor
                        value={csvRawText}
                        language="csv"
                        readOnly={false}
                        height="100%"
                        onChange={setCsvRawText}
                        highlightedLine={highlightedCsvLine}
                        scrollToLine={scrollToLine}
                      />
                    </CardContent>
                </Card>
              </div>
              <div className="h-4 flex-shrink-0" />
              <div className="min-h-0 flex flex-col flex-shrink-0 overflow-hidden" style={{height: '34%'}}>
                <Card className="h-full flex flex-col border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg overflow-hidden">
                   <CardHeader className="flex flex-row items-center justify-between bg-[#1e007d]/5 dark:bg-zinc-800/50 p-3 border-b border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0">
                         <div className="flex items-center space-x-4">
                           {overallCsvStatus === 'valid' ? (
                             <CheckCircle className="h-5 w-5 text-green-500" />
                           ) : overallCsvStatus === 'invalid' ? (
                             <XCircle className="h-5 w-5 text-red-500" />
                           ) : overallCsvStatus === 'pending' ? (
                             <FileText className="h-5 w-5 text-gray-400" />
                           ) : (
                             <AlertTriangle className="h-5 w-5 text-yellow-500" />
                           )}
                           <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">Validation Results</CardTitle>
                           {(totalErrorCount > 0 || totalWarningCount > 0) && (
                               <span className="text-lg text-muted-foreground font-bold">
                                   ({totalErrorCount > 0 ? `${totalErrorCount} Errors` : ''}
                                   {totalErrorCount > 0 && totalWarningCount > 0 ? ', ' : ''}
                                   {totalWarningCount > 0 ? `${totalWarningCount} Warnings` : ''})
                               </span>
                           )}
                         </div>
                         <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={handleCopyResults} disabled={validationResults.length === 0} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8">
                             <Copy className="h-4 w-4" />
                           </Button>
                         </TooltipTrigger> <TooltipContent side="bottom"><p>Copy Results</p></TooltipContent> </Tooltip> </TooltipProvider>
                     </CardHeader>
                     <ScrollArea className="h-full" type="auto"> 
                         <CardContent className="p-0 h-full overflow-auto">
                           <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                             {displayedResults.length === 0 && !isValidatingCsv && (
                               <div className="flex items-center justify-center p-10 text-muted-foreground">
                                 {overallCsvStatus === 'pending' ? 'Upload CSV and click Validate.' : 'No issues found.'}
                               </div>
                             )}
                             {isValidatingCsv && (
                               <div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</div>
                             )}
                             {displayedResults.length > 0 && displayedResults.map((result, idx) => {
                               const rowSeverity = result.errors.length > 0 ? 'error' : 'warning';
                               return (
                                 <Accordion
                                   key={result.row}
                                   type="single"
                                   collapsible
                                   className="w-full border-b border-muted/20 px-4"
                                   value={openAccordionValue}
                                   onValueChange={(val) => {
                                     setOpenAccordionValue(val);
                                     if (val && val.startsWith('item-')) {
                                       const rowIdx = parseInt(val.replace('item-', ''), 10);
                                       setHighlightedCsvLine(rowIdx + 2);
                                       setScrollToLine(rowIdx + 2);
                                     } else {
                                       setHighlightedCsvLine(undefined);
                                       setScrollToLine(undefined);
                                     }
                                   }}
                                 >
                                   <AccordionItem
                                     value={`item-${result.row}`}
                                     className="border-b-0"
                                   >
                                     <AccordionTrigger className={cn(
                                       "text-sm text-left hover:no-underline py-2 group flex items-center",
                                       rowSeverity === 'error'
                                         ? 'data-[state=open]:text-red-700 dark:data-[state=open]:text-red-300'
                                         : 'data-[state=open]:text-yellow-700 dark:data-[state=open]:text-yellow-300'
                                     )}> 
                                       <div className="flex items-center space-x-2 flex-grow truncate">
                                         {rowSeverity === 'error' ?
                                           <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" /> :
                                           <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                                         <span className="font-semibold">Row {result.row + 2}:</span>
                                         <span className="truncate flex-grow text-muted-foreground">
                                           {result.errors[0]?.message || result.warnings[0]?.message || 'Unknown issue'}
                                           {(result.errors.length + result.warnings.length) > 1 ? ` (+${result.errors.length + result.warnings.length - 1} more)` : ''}
                                         </span>
                                       </div>
                                       <ChevronDown className={cn(
                                         "h-4 w-4 ml-2 transition-transform duration-200",
                                         openAccordionValue === `item-${result.row}` ? 'rotate-180' : ''
                                       )} />
                                     </AccordionTrigger>
                                     <AccordionContent className="text-xs px-4 pt-2 pb-3 space-y-1 bg-muted/30 rounded-b">
                                       {result.errors.map((err, index) => (
                                         <div key={`err-${index}`} className="flex items-start text-red-600 dark:text-red-400">
                                           <XCircle className="h-3 w-3 mr-1.5 mt-0.5 flex-shrink-0" />
                                           <div>
                                             <span className="font-semibold">Error:</span> <span className="font-medium">{err.property || 'N/A'}</span> - {err.message}
                                           </div>
                                         </div>
                                       ))}
                                       {result.warnings.map((warn, index) => (
                                         <div key={`warn-${index}`} className="flex items-start text-yellow-600 dark:text-yellow-400">
                                           <AlertTriangle className="h-3 w-3 mr-1.5 mt-0.5 flex-shrink-0" />
                                           <div>
                                             <span className="font-semibold">Warning:</span> <span className="font-medium">{warn.property || 'N/A'}</span> - {warn.message}
                                           </div>
                                         </div>
                                       ))}
                                     </AccordionContent>
                                   </AccordionItem>
                                 </Accordion>
                               );
                             })}
                           </div>
                         </CardContent>
                         {validationResults.length > visibleResultCount && (
                             <CardFooter className="p-3 border-t border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0 justify-center">
                                 <Button
                                     variant="secondary"
                                     onClick={handleShowMoreResults}
                                     disabled={isValidatingCsv}
                                 >
                                     Show More Results ({displayedResults.length} / {validationResults.length})
                                 </Button>
                             </CardFooter>
                         )}
                     </ScrollArea> 
                </Card>
              </div>
            </div>
          )}
        </div>

         <input
           type="file"
           ref={fileInputRef}
           onChange={handleCsvUpload}
           accept=".csv, text/csv"
           style={{ display: 'none' }}
         />
         <input
           type="file"
           ref={jsonInputRef}
           onChange={handleSchemaUpload}
           accept=".json, application/json"
           style={{ display: 'none' }}
         />

    </div>
  );
}