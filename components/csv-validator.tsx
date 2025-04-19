"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import CodeEditor from "@/components/code-editor";
import ThemeToggle from "@/components/theme-toggle";
import {
  Copy,
  FileText,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Save,
  Info,
  Key,
  ClipboardList,
} from "lucide-react";
import Papa from "papaparse";
import { useVirtualizer } from "@tanstack/react-virtual";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import ValidationResults from "@/components/validation-results";
import Image from "next/image";

// --- Web Worker Setup ---
const getWorker = (() => {
  let worker: Worker | null = null;
  return () => {
    if (!worker) {
      worker = new Worker(
        new URL("../workers/csv-validator.worker.js", import.meta.url),
      );
    }
    return worker;
  };
})();

// --- Schema cache ---
const schemaListCache: { list?: string[] } = {};
const schemaContentCache: Record<string, Record<string, unknown> | string> = {};

// --- Custom Markdown Components for Styling ---
// const CustomH1 = ({ _node, children, ...props }: any) => (
//   <h1 className="text-2xl font-bold mt-6 mb-3 border-b pb-1" {...props}>
//     {children}
//   </h1>
// );
// const CustomH2 = ({ _node, children, ...props }: any) => (
//   <h2 className="text-lg font-semibold mt-4 mb-2" {...props}>
//     {children}
//   </h2>
// );
// const CustomTable = ({ _node, ...props }: any) => (
//   <table className="w-full my-3 border-collapse text-sm" {...props} />
// );
// const CustomThead = ({ _node, ...props }: any) => (
//   <thead className="hidden" {...props} />
// ); 
// const CustomTbody = ({ _node, ...props }: any) => <tbody {...props} />;
// const CustomTr = ({ _node, ...props }: any) => (
//   <tr className="border-b border-muted/40" {...props} />
// );
// const CustomTh = ({ _node, ...props }: any) => (
//   <th className="p-2 text-left font-semibold w-1/4" {...props} />
// ); 
// const CustomTd = ({ _node, ...props }: any) => (
//   <td className="p-2 align-top" {...props} />
// ); 
// const CustomCode = ({ _node, ...props }: any) => (
//   <code
//     className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono"
//     {...props}
//   />
// );
// const CustomP = ({ _node, ...props }: any) => (
//   <p className="mb-2 leading-relaxed" {...props} />
// );
// const CustomHr = ({ _node, ...props }: any) => (
//   <hr className="my-6 border-border" {...props} />
// );

// --- Modern Custom Markdown Components for Schema Doc Styling ---
const SchemaH1 = ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h1 className="text-3xl font-extrabold mt-8 mb-4 flex items-center gap-2 text-gradient-to-r from-blue-600 to-purple-600">
    <ClipboardList className="h-6 w-6 text-blue-500" /> {props.children}
  </h1>
);
const SchemaH2 = ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className="text-xl font-bold mt-6 mb-2 flex items-center gap-2 text-purple-700 dark:text-purple-300">
    <Key className="h-5 w-5 text-purple-500" /> {props.children}
  </h2>
);
const SchemaTable = ({ ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <table className="w-full my-3 border-separate border-spacing-y-1 text-sm bg-white/80 dark:bg-zinc-900/40 rounded-xl overflow-hidden shadow">
    {props.children}
  </table>
);
const SchemaTh = ({ ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
  <th
    className="p-2 text-left font-semibold bg-blue-50 dark:bg-zinc-800 text-blue-900 dark:text-blue-200"
    {...props}
  />
);
const SchemaTd = ({ ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
  <td className="p-2 align-top" {...props} />
);
const SchemaBlockquote = ({ ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
  <blockquote className="border-l-4 border-blue-400 bg-blue-50/60 dark:bg-zinc-800/40 p-3 my-3 rounded-md text-blue-900 dark:text-blue-200 flex items-start gap-2">
    <Info className="h-5 w-5 text-blue-400 mt-0.5" />
    <span>{props.children}</span>
  </blockquote>
);
const SchemaCode = ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
  <code
    className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono text-blue-700 dark:text-blue-200"
    {...props}
  />
);
const SchemaP = ({ ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className="mb-2 leading-relaxed text-zinc-700 dark:text-zinc-200"
    {...props}
  />
);

// --- Badge Renderer for Markdown (for enums, types, required, etc.) ---
// const SchemaBadge = ({ children, color = "blue", icon }: any) => (
//   <Badge
//     className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-${color}-100 text-${color}-800 dark:bg-${color}-900/40 dark:text-${color}-200 mr-1 mb-1`}
//   >
//     {icon && React.createElement(icon, { className: "h-3 w-3 mr-0.5" })}
//     {children}
//   </Badge>
// );

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

// Interface for the schema list API response
interface SchemaListResponse {
  schemas: string[];
}

// Interface for single schema content API response
interface SchemaContentResponse {
  content: Record<string, unknown> | string;
}

// Interfaces for Worker messages
interface WorkerMessageResultsBatch {
  type: 'resultsBatch';
  payload: { results: RowValidationResults[] };
}

interface WorkerMessageComplete {
  type: 'complete';
  payload: { totalErrors: number; totalWarnings: number };
}

interface WorkerMessageError {
  type: 'error';
  payload: { message: string };
}

type WorkerMessageData = 
  | WorkerMessageResultsBatch 
  | WorkerMessageComplete 
  | WorkerMessageError;

// Debounce utility
// function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
//   let timer: ReturnType<typeof setTimeout>;
//   return (...args: Parameters<T>) => {
//     clearTimeout(timer);
//     timer = setTimeout(() => fn(...args), delay);
//   };
// }

export default function CsvValidator() {
  // --- State Variables --- // Uncomment most
  const [availableSchemaNames, setAvailableSchemaNames] = useState<string[]>(
    [],
  ); // List of schema filenames
  const [selectedSchemaName, setSelectedSchemaName] = useState<string>(""); // Currently selected filename
  const [selectedSchemaContent, setSelectedSchemaContent] = useState<Record<string, unknown> | string>(""); // Allow object or string
  const [uploadedSchemaContent, setUploadedSchemaContent] = useState<
    Record<string, unknown> | null
  >(null); // Use Record<string, unknown> instead of any
  const [uploadedSchemaName, setUploadedSchemaName] = useState<string | null>(
    null,
  ); // State for uploaded schema name
  const [useUploadedSchema, setUseUploadedSchema] = useState<boolean>(false); // Flag for using uploaded schema
  const [csvRawText, setCsvRawText] = useState<string>("");
  const [validationResults, setValidationResults] = useState<
    RowValidationResults[]
  >([]); // Updated state type
  const [totalErrorCount, setTotalErrorCount] = useState<number>(0);
  const [totalWarningCount, setTotalWarningCount] = useState<number>(0);
  const [visibleResultCount, setVisibleResultCount] = useState<number>(20); // State for visible results
  const [isLoadingSchemaList, setIsLoadingSchemaList] = useState<boolean>(true);
  const [isLoadingSchemaContent, setIsLoadingSchemaContent] =
    useState<boolean>(false);
  const [isLoadingCsv, setIsLoadingCsv] = useState<boolean>(false);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [overallCsvStatus, setOverallCsvStatus] = useState<
    "valid" | "invalid" | "pending" | "error"
  >("pending");
  const [openAccordionValue, setOpenAccordionValue] = useState<
    string | undefined
  >(undefined); // State to track the open accordion item
  const [isJsonPanelVisible, setIsJsonPanelVisible] = useState<boolean>(false); // Keep one state for testing
  const [schemaMarkdown, setSchemaMarkdown] = useState<string>(""); // State for generated Markdown
  const [isFetchingMarkdown, setIsFetchingMarkdown] = useState<boolean>(false); // State for markdown fetch loading
  const [highlightedCsvLine, setHighlightedCsvLine] = useState<
    number | undefined
  >(undefined);
  const [scrollToLine, setScrollToLine] = useState<number | undefined>(
    undefined,
  );
  const [workerBusy, setWorkerBusy] = useState(false);
  const [lastRenderedSchemaName, setLastRenderedSchemaName] = useState<string | null>(null);

  // Uncomment Refs
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden CSV input
  const jsonInputRef = useRef<HTMLInputElement>(null); // Ref for hidden JSON input
  const workerRef = useRef<Worker | null>(null);
  const validationBatchRef = useRef<RowValidationResults[]>([]);
  const validationTimeout = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();

  const parentRef = useRef<HTMLDivElement>(null); // Ref for the *main* scrollable element

  // Derived state for displayed results
  const displayedResults = useMemo(() => {
    // Sort: errors first, then warnings, then none (if any)
    return [...validationResults]
      .sort((a, b) => {
        // Errors first
        if (a.errors.length > 0 && b.errors.length === 0) return -1;
        if (a.errors.length === 0 && b.errors.length > 0) return 1;
        // If both have errors or both have none, preserve order
        return a.row - b.row;
      })
      .slice(0, visibleResultCount);
  }, [validationResults, visibleResultCount]);

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
  }, [validationResults, visibleResultCount]);

  // --- Function to Fetch and Render Schema Docs ---
  const fetchAndRenderSchemaDoc = useCallback(async () => {
    const schemaToRender = useUploadedSchema ? uploadedSchemaContent : selectedSchemaContent;

    if (!schemaToRender || typeof schemaToRender === 'string') {
      setSchemaMarkdown(
        schemaToRender === "" ? "_Select or upload a schema to view documentation._" : "_Invalid schema format for documentation._"
      );
      // Set last rendered even if invalid, so we don't retry constantly
      setLastRenderedSchemaName(useUploadedSchema ? uploadedSchemaName : selectedSchemaName);
      return;
    }

    const currentSourceName = useUploadedSchema ? uploadedSchemaName : selectedSchemaName;
    // Avoid re-rendering if the same schema (by name) is already displayed
    if (currentSourceName && currentSourceName === lastRenderedSchemaName) {
        console.log(`Skipping doc render for already displayed schema: ${currentSourceName}`);
        return;
    }

    setIsFetchingMarkdown(true);
    setSchemaMarkdown("Loading documentation..."); // Placeholder

    try {
      // Fetch schema doc
      const response = await fetch("/api/generate-schema-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: schemaToRender } as Record<string, unknown>),
      });

      if (!response.ok) {
        let errorDetails = `Failed to fetch schema documentation (${response.status})`;
        try {
          const errorData = await response.json() as Record<string, unknown>; // Attempt to parse error
          // Type guard for safer access
          if (errorData && typeof errorData === 'object') {
              if ('details' in errorData && errorData.details) {
                  // Safely stringify details if it exists
                  errorDetails = JSON.stringify(errorData.details); 
              } else if ('error' in errorData && errorData.error) {
                  // Handle Error object or stringify other types
                  errorDetails = errorData.error instanceof Error ? errorData.error.message : JSON.stringify(errorData.error); // Use JSON.stringify for objects
              }
          }
        } catch /* Removed parseError */ {
          console.warn("Could not parse error response from generate-schema-doc");
          errorDetails += `: ${response.statusText}`; // Fallback to status text
        }
        throw new Error(errorDetails);
      }

      // Type the expected successful response
      const data = await response.json() as { markdown: string }; // ADDED CAST
      setSchemaMarkdown(data.markdown);
      setLastRenderedSchemaName(currentSourceName); // Update last rendered name

      // Update/dismiss the loading toast on success
      toast({ title: "Documentation Ready", description: "Schema documentation loaded successfully.", duration: 3000 });

    } catch (error: unknown) { // Use unknown for caught error
      console.error("Error fetching/rendering schema doc:", error);
      // Use type guard to get message
      const message = error instanceof Error ? error.message : "Could not load documentation";
      setSchemaMarkdown(`# Error loading documentation\n\n\`\`\`\n${message}\n\`\`\``); // Display error in markdown panel
      setLastRenderedSchemaName(null); // Clear last rendered on error so it can be retried

      // Update/dismiss the loading toast on error
      toast({ title: "Documentation Error", description: message, variant: "destructive", duration: 10000 });

    } finally {
      setIsFetchingMarkdown(false);
    }
  }, [
    selectedSchemaContent,
    uploadedSchemaContent,
    useUploadedSchema,
    toast,
    uploadedSchemaName,
    selectedSchemaName,
    lastRenderedSchemaName,
    setLastRenderedSchemaName,
  ]);

  // --- Effect to fetch schema list on mount --- // Keep uncommented for now
  useEffect(() => {
    const fetchSchemaList = async () => {
      setIsLoadingSchemaList(true);
      try {
        if (schemaListCache.list) {
          setAvailableSchemaNames(schemaListCache.list);
          setIsLoadingSchemaList(false);
          return;
        }
        const response = await fetch("/api/schemas");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = (await response.json()) as SchemaListResponse;
        const sortedSchemas = data.schemas.sort(); // Sort alphabetically
        schemaListCache.list = sortedSchemas; // Cache the sorted list
        setAvailableSchemaNames(sortedSchemas);

        // Automatically select the first schema if available
        if (sortedSchemas.length > 0 && !selectedSchemaName) {
          setSelectedSchemaName(sortedSchemas[0]);
        }
      } catch (error: unknown) {
        console.error("Error fetching schema list:", error);
        void toast({
          title: "Error",
          description:
            "Could not fetch the list of available schemas. Please check the API or try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSchemaList(false);
      }
    };

    void fetchSchemaList();
    // Add dependencies here if needed, e.g., if fetchSchemaList depends on props or other state
  }, [toast, selectedSchemaName]); // Added toast and selectedSchemaName as dependencies

  // --- Effect to fetch schema content when selection changes --- // Uncomment
  useEffect(() => {
    if (!selectedSchemaName && !useUploadedSchema) {
      // Adjusted condition
      setSelectedSchemaContent("");
      setSchemaMarkdown(""); // Clear markdown when schema is unselected/cleared
      return;
    }

    const fetchSchemaContent = async () => {
      setIsLoadingSchemaContent(true);
      try {
        if (
          !useUploadedSchema &&
          selectedSchemaName &&
          schemaContentCache[selectedSchemaName]
        ) {
          setSelectedSchemaContent(schemaContentCache[selectedSchemaName]);
          setIsLoadingSchemaContent(false);
          if (isJsonPanelVisible) {
            await fetchAndRenderSchemaDoc();
          }
          return;
        }
        if (!useUploadedSchema && selectedSchemaName) {
          const response = await fetch(`/api/schemas/${selectedSchemaName}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json() as SchemaContentResponse;
          const newSchemaContent = data.content;
          schemaContentCache[selectedSchemaName] = newSchemaContent;
          setSelectedSchemaContent(newSchemaContent);
          setIsLoadingSchemaContent(false);
          if (isJsonPanelVisible) {
            await fetchAndRenderSchemaDoc();
          }
          return;
        }
        if (useUploadedSchema && uploadedSchemaContent) {
          const newSchemaContent = JSON.stringify(
            uploadedSchemaContent,
            null,
            2,
          );
          setSelectedSchemaContent(newSchemaContent);
          setIsLoadingSchemaContent(false);
          if (isJsonPanelVisible) {
            await fetchAndRenderSchemaDoc();
          }
          return;
        }
        setSelectedSchemaContent("");
        setIsLoadingSchemaContent(false);
        setSchemaMarkdown("");
      } catch (error) {
        console.error("Error fetching schema content:", error);
        void toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to load schema '${selectedSchemaName}'.`,
        });
        setSelectedSchemaContent("");
        setIsLoadingSchemaContent(false);
        setSchemaMarkdown("");
      }
    };

    void fetchSchemaContent();
  }, [
    selectedSchemaName,
    useUploadedSchema,
    uploadedSchemaContent,
    toast,
    isJsonPanelVisible,
    fetchAndRenderSchemaDoc,
  ]); // Added isJsonPanelVisible & fetchAndRenderSchemaDoc

  // --- Handlers --- // Uncomment all
  const handleSchemaSelectionChange = (schemaName: string) => {
    if (schemaName === "uploaded-schema" && uploadedSchemaContent) {
      setUseUploadedSchema(true);
      setSelectedSchemaName(uploadedSchemaName || "uploaded-schema"); // Keep track
      // Directly use uploaded content (handled in useEffect now)
    } else if (schemaName && schemaName !== "uploaded-schema") {
      setUseUploadedSchema(false);
      setSelectedSchemaName(schemaName);
      // Fetching handled by useEffect
    }
  };

  const handleCsvUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setIsLoadingCsv(true);
      setCsvFileName(file.name);
      setOverallCsvStatus("pending"); // Reset status
      void toast({
        title: "Parsing CSV",
        description: `Processing ${file.name}...`,
      });

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvRawText(text);

        Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true, // changed from false
          complete: (results) => {
            // Check for Papa Parse errors specifically
            if (results.errors.length > 0) {
              console.error("CSV Parsing Errors:", results.errors);
              // Add null checks for the first error object
              const firstError = results.errors[0];
              // Use nullish coalescing for defaults. Add 1 to row index.
              const errorRow = (firstError?.row ?? -1) + 1;
              const errorMessage =
                firstError?.message ?? "Unknown parsing error";
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
              setOverallCsvStatus("invalid");
            } else {
              setOverallCsvStatus("pending"); // Set to pending as validation hasn't run
            }
            setIsLoadingCsv(false);
          },
          error: (error: Error) => {
            console.error("CSV Parsing Failed:", error);
            setValidationResults([
              {
                row: -1,
                errors: [
                  {
                    property: "CSV File",
                    message: error.message,
                  },
                ],
                warnings: [],
              },
            ]);
            setOverallCsvStatus("error");
            setIsLoadingCsv(false);
          },
        });
      };
      reader.readAsText(file);
    },
    [toast],
  ); // Add toast dependency if used inside

  const handleSaveCsv = () => {
    if (!csvRawText.trim()) {
      void toast({
        variant: "destructive",
        title: "Error",
        description: "No CSV data to save.",
      });
      return;
    }

    try {
      // --- Save Logic ---
      const blob = new Blob([csvRawText], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const filename = csvFileName || "edited_data.csv";
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      void toast({ title: "CSV Saved", description: `Saved data as ${filename}` });
    } catch (error) {
      console.error("Error saving CSV:", error);
      void toast({
        variant: "destructive",
        title: "Save Error",
        description: "Could not save CSV data.",
      });
    }
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
        const parsedJson = JSON.parse(text) as Record<string, unknown>;
        // Basic check if it looks like a schema
        if (
          typeof parsedJson !== "object" ||
          parsedJson === null ||
          !("$schema" in parsedJson) ||
          typeof parsedJson.$schema !== 'string'
        ) {
          throw new Error("Invalid JSON content or missing/invalid $schema keyword.");
        }

        setUploadedSchemaContent(parsedJson);
        setUploadedSchemaName(file.name);
        setSelectedSchemaContent(text); // Update editor view
        setUseUploadedSchema(true);
        setOverallCsvStatus("pending");
        void toast({
          title: "Schema Uploaded",
          description: `Using uploaded schema: ${file.name}`,
        });
      } catch (error: unknown) {
        console.error("Failed to parse uploaded JSON schema:", error);
        const message = error instanceof Error ? error.message : "Unknown error parsing JSON";
        void toast({
          variant: "destructive",
          title: "Schema Upload Error",
          description: `Failed to parse JSON file: ${message}`,
        });
        // Reset state if upload fails
        setUploadedSchemaContent(null);
        setUploadedSchemaName(null);
        setUseUploadedSchema(false);
      }
    };
    reader.onerror = (error) => {
      console.error("Failed to read uploaded file:", error);
      void toast({
        variant: "destructive",
        title: "File Read Error",
        description: "Could not read the selected file.",
      });
    };
    reader.readAsText(file);

    // Reset the file input
    if (event.target) {
      event.target.value = "";
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
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json() as SchemaContentResponse;
        setSelectedSchemaContent(data.content);
        void toast({
          title: "Schema Cleared",
          description: `Restored schema: ${selectedSchemaName}`,
        });
      } catch (error) {
        console.error("Error re-fetching schema content:", error);
        void toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to restore schema '${selectedSchemaName}'.`,
        });
        setSelectedSchemaContent("// Error loading schema.");
      }
      setIsLoadingSchemaContent(false);
    } else {
      setSelectedSchemaContent("// Select a schema or upload one."); // Handle case where no dropdown schema was selected
      void toast({ title: "Schema Cleared" });
    }
  }, [selectedSchemaName, toast]); // Add dependencies

  const handleCopyResults = () => {
    // Include warnings in copied results
    const resultsText = JSON.stringify(validationResults, null, 2);
    navigator.clipboard.writeText(resultsText).then(
      () => {
        void toast({
          title: "Results Copied!",
          description:
            "Validation results (errors and warnings) copied to clipboard.",
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (_err) => {
        void toast({
          title: "Copy Failed",
          description: "Could not copy results.",
          variant: "destructive",
        });
      },
    );
  };

  const handleShowMoreResults = () => {
    setVisibleResultCount((prev) =>
      Math.min(prev + 20, validationResults.length),
    );
  };

  // --- Handler to Toggle JSON Panel --- // Updated to use fetchAndRenderSchemaDoc
  const toggleJsonPanel = async () => {
    if (isJsonPanelVisible) {
      setIsJsonPanelVisible(false);
    } else {
      await fetchAndRenderSchemaDoc(); // Fetch/render
      setIsJsonPanelVisible(true); // Then show
    }
  };

  // --- Handler to clear CSV data --- // ADDED
  const handleClearCsv = useCallback(() => {
      setCsvRawText("");
      setCsvFileName("");
      setValidationResults([]);
      setTotalErrorCount(0);
      setTotalWarningCount(0);
      setOverallCsvStatus("pending");
      setHighlightedCsvLine(undefined);
      toast({ title: "CSV Cleared", description: "Input data has been removed." });
  }, [
    // Add setters as dependencies if needed, e.g. setCsvRawText
    toast, 
    setCsvRawText, 
    setCsvFileName, 
    setValidationResults, 
    setTotalErrorCount, 
    setTotalWarningCount, 
    setOverallCsvStatus, 
    setHighlightedCsvLine
  ]);

  // --- Memoized expensive handlers ---
  const memoizedSetValidationResults = useCallback(
    (results: RowValidationResults[]) => setValidationResults(results),
    [],
  );

  // --- Worker validation logic ---
  const runWorkerValidation = useCallback(
    (csv: string, schema: Record<string, unknown> | string) => {
      setWorkerBusy(true);
      validationBatchRef.current = [];
      const worker = getWorker();
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<WorkerMessageData>) => {
        const { type, payload } = event.data;
        if (type === "resultsBatch") {
          validationBatchRef.current = [
            ...validationBatchRef.current,
            ...payload.results,
          ];
          memoizedSetValidationResults([...validationBatchRef.current]);
        } else if (type === "complete") {
          setWorkerBusy(false);
          setTotalErrorCount(payload.totalErrors || 0);
          setTotalWarningCount(payload.totalWarnings || 0);
          setOverallCsvStatus(
            payload.totalErrors === 0 ? "valid" : "invalid",
          );
        } else if (type === "error") {
          setWorkerBusy(false);
          setOverallCsvStatus("error");
        }
      };
      // Parse CSV and schema before sending to worker
      let parsedCsv: Record<string, unknown>[] = [];
      let parsedSchema: Record<string, unknown> | undefined = undefined;
      let firstDataRowLine = 2; // Default: header is line 1, first data row is line 2
      try {
        // Count lines before header (to support CSVs that start at arbitrary lines)
        const lines = csv.split(/\r?\n/);
        let headerLineIdx = lines.findIndex(
          (line) => line.trim() && !line.startsWith("#"),
        );
        if (headerLineIdx === -1) headerLineIdx = 0;
        firstDataRowLine = headerLineIdx + 2; // header line + 1 for first data row (1-based)
        const parseResult = Papa.parse<Record<string, unknown>>(csv, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false, // Always keep as string for schema validation
        });
        parsedCsv = parseResult.data;
      } catch /* _e */ {
        setWorkerBusy(false);
        setOverallCsvStatus("error");
        return;
      }
      try {
        parsedSchema = typeof schema === "string" ? JSON.parse(schema) as Record<string, unknown> : schema;
      } catch (e: unknown) {
        console.error("Schema parsing error before sending to worker:", e);
        const message = e instanceof Error ? e.message : "Invalid schema format";
        toast({ title: "Schema Error", description: message, variant: "destructive" });
        setWorkerBusy(false);
        setOverallCsvStatus("error");
        return;
      }
      worker.postMessage({
        type: "validate",
        payload: { csvData: parsedCsv, schema: parsedSchema, firstDataRowLine },
      });
    },
    [memoizedSetValidationResults, toast],
  );

  // --- Debounced validation trigger ---
  const debouncedValidate = useMemo(() => {
    let timeout: NodeJS.Timeout | null = null;
    return (csv: string, schema: Record<string, unknown> | string) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        runWorkerValidation(csv, schema);
      }, 350);
    };
  }, [runWorkerValidation]);

  // --- CSV edit effect: debounce and use worker ---
  useEffect(() => {
    const effectiveSchema = useUploadedSchema ? uploadedSchemaContent : selectedSchemaContent;

    if (!csvRawText.trim() || !effectiveSchema) { // Combined checks
      setValidationResults([]);
      setOverallCsvStatus("pending");
      setTotalErrorCount(0);
      setTotalWarningCount(0);
      setVisibleResultCount(20);
      // Optionally cancel any pending worker task if schema becomes null
      if (workerRef.current && workerBusy) {
        workerRef.current.terminate(); 
        workerRef.current = null; // Clear ref
        setWorkerBusy(false);
      }
      if (validationTimeout.current) clearTimeout(validationTimeout.current);
      return;
    }
    // Debounced and use worker on every csvRawText change
    // Provide default empty object to satisfy type checker, although the if check prevents null case
    debouncedValidate(
        csvRawText,
        effectiveSchema ?? {},
    );
    
  }, [
    csvRawText,
    selectedSchemaContent,
    uploadedSchemaContent,
    useUploadedSchema,
    debouncedValidate, // Keep debouncedValidate here
    workerBusy // ADD workerBusy to dependency array
    // No need to include effectiveSchema directly, its parts are dependencies
  ]);

  return (
    <div className="flex flex-col h-screen w-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e007d]/10 dark:border-zinc-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Image
            src="/lavitrine_logo.svg"
            alt="Company Logo"
            width={64}
            height={64}
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
          <span className="text-sm font-medium text-muted-foreground">
            Schema:
          </span>
          <Select
            value={useUploadedSchema ? "uploaded-schema" : selectedSchemaName} // Ensure value reflects uploaded state
            onValueChange={handleSchemaSelectionChange}
            disabled={isLoadingSchemaList || availableSchemaNames.length === 0}
          >
            <SelectTrigger className="w-[220px] bg-background border-[#1e007d]/20 dark:border-zinc-700">
              <SelectValue
                placeholder={
                  isLoadingSchemaList ? "Loading..." : "Select Schema"
                }
              />
            </SelectTrigger>
            <SelectContent className="dark:bg-zinc-800">
              {isLoadingSchemaList ? (
                <SelectItem value="loading" disabled>
                  Loading...
                </SelectItem>
              ) : availableSchemaNames.length === 0 && !uploadedSchemaName ? (
                <SelectItem value="no-schemas" disabled>
                  No schemas found
                </SelectItem>
              ) : null}
              {availableSchemaNames.map((schema) => {
                const value =
                  typeof schema === "string" ? schema : (schema as { filename: string }).filename;
                const label =
                  typeof schema === "string"
                    ? schema.replace(/\.json$/, "")
                    : (schema as { name: string }).name;
                return (
                  <SelectItem
                    key={value}
                    value={value}
                    className="dark:focus:bg-zinc-700"
                  >
                    {label}
                  </SelectItem>
                );
              })}
              {uploadedSchemaContent && (
                <SelectItem
                  value="uploaded-schema"
                  className="dark:focus:bg-zinc-700"
                >
                  {uploadedSchemaName || "Uploaded Schema"}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <TooltipProvider delayDuration={100}>
          {" "}
          <Tooltip>
            {" "}
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadSchemaClick}
                className="border-[#1e007d]/20 dark:border-zinc-700"
              >
                <Upload className="h-4 w-4 mr-2" /> Upload Schema
              </Button>
            </TooltipTrigger>{" "}
            <TooltipContent side="bottom">
              <p>Upload Custom Schema (.json)</p>
            </TooltipContent>{" "}
          </Tooltip>{" "}
        </TooltipProvider>

        {useUploadedSchema && (
          <TooltipProvider delayDuration={100}>
            {" "}
            <Tooltip>
              {" "}
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleClearUploadedSchema()}
                  className="text-destructive hover:bg-destructive/10 border-destructive/50"
                >
                  <X className="h-4 w-4 mr-2" /> Clear Uploaded
                </Button>
              </TooltipTrigger>{" "}
              <TooltipContent side="bottom">
                <p>Clear Uploaded Schema</p>
              </TooltipContent>{" "}
            </Tooltip>{" "}
          </TooltipProvider>
        )}

        <TooltipProvider delayDuration={100}>
          {" "}
          <Tooltip>
            {" "}
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void toggleJsonPanel()}
                disabled={
                  isLoadingSchemaContent ||
                  isFetchingMarkdown ||
                  (!selectedSchemaName && !useUploadedSchema)
                }
                className="border-[#1e007d]/20 dark:border-zinc-700"
              >
                {isFetchingMarkdown ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isJsonPanelVisible ? "Hide Schema View" : "Show Schema View"}
              </Button>
            </TooltipTrigger>{" "}
            <TooltipContent side="bottom">
              <p>
                {isJsonPanelVisible
                  ? "Hide human-readable schema"
                  : "Show human-readable schema"}
              </p>
            </TooltipContent>{" "}
          </Tooltip>{" "}
        </TooltipProvider>

        <div className="flex-grow"></div>

        <Button
          onClick={() => {
            const effectiveSchema = useUploadedSchema
              ? uploadedSchemaContent
              : selectedSchemaContent;
            // Only call validate if effectiveSchema is not null
            if (effectiveSchema) {
              debouncedValidate(
                csvRawText,
                effectiveSchema, // Pass the non-null schema
              );
            } else {
              // Optional: Show a toast or log an error if schema is missing
              toast({
                title: "Schema Missing",
                description: "Please select or upload a schema before validating.",
                variant: "destructive",
              });
            }
          }}
          disabled={
            workerBusy ||
            !csvRawText.trim() ||
            (!selectedSchemaName && !useUploadedSchema) ||
            !(useUploadedSchema ? uploadedSchemaContent : selectedSchemaContent)
          }
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          {workerBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...
            </>
          ) : (
            "Validate Data"
          )}
        </Button>
      </section>

      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 pt-6 pb-4"
        style={{ height: "calc(100vh - 112px - 72px)" }}
      >
        {isJsonPanelVisible ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
              className="flex flex-row gap-6 flex-1 min-h-0"
              style={{ 
                height: "66%",
                transitionProperty: "all",
                transitionDuration: "300ms",
                transitionTimingFunction: "cubic-bezier(0.77,0,0.175,1)"
              }}
            >
              {/* Schema panel */}
              <div className="w-1/2 min-w-0 flex flex-col h-full overflow-hidden">
                <Card className="flex-1 min-h-0 flex flex-col h-full border-[#1e007d]/20 dark:border-zinc-700 shadow-md dark:shadow-zinc-900/50 rounded-lg">
                  <CardHeader className="flex-shrink-0 p-3 border-b border-[#1e007d]/10 dark:border-zinc-600">
                    <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">
                      Schema Documentation
                    </CardTitle>
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
                        {!selectedSchemaName && !useUploadedSchema
                          ? "Select or upload a schema."
                          : 'Click "Show Schema Doc" to generate documentation.'}
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
                      <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">
                        CSV Data
                      </CardTitle>
                      {csvFileName && (
                        <span className="text-xs text-muted-foreground truncate">
                          ({csvFileName})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <TooltipProvider delayDuration={100}>
                        {" "}
                        <Tooltip>
                          {" "}
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveCsv();
                              }}
                              className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8"
                              disabled={!csvRawText.trim()}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>{" "}
                          <TooltipContent side="bottom">
                            <p>Save Edited CSV</p>
                          </TooltipContent>{" "}
                        </Tooltip>{" "}
                      </TooltipProvider>
                      {csvRawText.trim() && (
                        <TooltipProvider delayDuration={100}>
                          {" "}
                          <Tooltip>
                            {" "}
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearCsv();
                                }}
                                className="hover:bg-destructive/10 text-destructive h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>{" "}
                            <TooltipContent side="bottom">
                              <p>Clear CSV Data</p>
                            </TooltipContent>{" "}
                          </Tooltip>{" "}
                        </TooltipProvider>
                      )}
                    </div>
                  </CardHeader>

                  <div className="flex flex-col items-center justify-center px-1 pt-1 pb-1">
                    {csvFileName ? (
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        disabled={
                          isLoadingSchemaContent || workerBusy || isLoadingCsv
                        }
                        className={`w-8 h-8 flex items-center justify-center rounded border-2 border-dashed border-[#1e007d]/30 dark:border-zinc-600 bg-white/60 dark:bg-zinc-900/40 shadow-sm hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed ${csvFileName ? "border-green-400 bg-green-50/60 dark:bg-green-900/20" : ""}`}
                        tabIndex={0}
                        aria-label="Upload another CSV file"
                      >
                        <Upload className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        disabled={
                          isLoadingSchemaContent || workerBusy || isLoadingCsv
                        }
                        className={`w-28 h-10 flex flex-col items-center justify-center rounded border-2 border-dashed border-[#1e007d]/30 dark:border-zinc-600 bg-white/60 dark:bg-zinc-900/40 shadow-sm hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed`}
                        tabIndex={0}
                      >
                        <Upload className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                        <span className="text-xs font-medium text-[#1e007d] dark:text-blue-200 mt-0.5">
                          Upload CSV
                        </span>
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
            <div
              className="w-full min-h-0 flex flex-col flex-shrink-0"
              style={{ height: "34%" }}
            >
              <Card className="h-full flex flex-col border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg overflow-hidden">
                <CardHeader
                  className={cn(
                    "flex flex-row items-center justify-between p-3 border-b flex-shrink-0",
                    overallCsvStatus === "valid"
                      ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700"
                      : overallCsvStatus === "invalid"
                        ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
                        : "bg-[#1e007d]/5 dark:bg-zinc-800/50 border-[#1e007d]/10 dark:border-zinc-600",
                  )}
                >
                  <div className="flex items-center space-x-4">
                    {overallCsvStatus === "valid" ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : overallCsvStatus === "invalid" ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : overallCsvStatus === "pending" ? (
                      <FileText className="h-5 w-5 text-gray-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">
                      Validation Results
                    </CardTitle>
                    {(totalErrorCount > 0 || totalWarningCount > 0) && (
                      <span className="text-lg text-muted-foreground font-bold">
                        (
                        {totalErrorCount > 0 ? `${totalErrorCount} Errors` : ""}
                        {totalErrorCount > 0 && totalWarningCount > 0
                          ? ", "
                          : ""}
                        {totalWarningCount > 0
                          ? `${totalWarningCount} Warnings`
                          : ""}
                        )
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {overallCsvStatus === "valid" && (
                      <span className="flex items-center text-green-700 dark:text-green-300 font-bold text-base bg-green-50 dark:bg-green-900/40 px-3 py-1 rounded-full">
                        <CheckCircle className="h-5 w-5 mr-1 text-green-500" />
                        Success: Data is valid!
                      </span>
                    )}
                    {overallCsvStatus === "invalid" && (
                      <span className="flex items-center text-red-700 dark:text-red-300 font-bold text-base bg-red-50 dark:bg-red-900/40 px-3 py-1 rounded-full">
                        <XCircle className="h-5 w-5 mr-1 text-red-500" />
                        Invalid data
                      </span>
                    )}
                    <TooltipProvider delayDuration={100}>
                      {" "}
                      <Tooltip>
                        {" "}
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyResults}
                            disabled={validationResults.length === 0}
                            className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>{" "}
                        <TooltipContent side="bottom">
                          <p>Copy Results</p>
                        </TooltipContent>{" "}
                      </Tooltip>{" "}
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <ScrollArea className="h-full" type="auto">
                  <CardContent className="p-0 h-full overflow-auto">
                    <div
                      style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                      }}
                    >
                      {displayedResults.length === 0 && !workerBusy && (
                        <div className="flex items-center justify-center p-10 text-muted-foreground">
                          {overallCsvStatus === "pending"
                            ? "Upload CSV and click Validate."
                            : "No issues found."}
                        </div>
                      )}
                      {workerBusy && (
                        <div className="flex items-center justify-center p-10 text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                          Validating...
                        </div>
                      )}
                      <ValidationResults
                        results={displayedResults}
                        openAccordionValue={openAccordionValue}
                        setOpenAccordionValue={setOpenAccordionValue}
                        setHighlightedCsvLine={setHighlightedCsvLine}
                        setScrollToLine={setScrollToLine}
                      />
                    </div>
                  </CardContent>
                  {validationResults.length > visibleResultCount && (
                    <CardFooter className="p-3 border-t border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0 justify-center">
                      <Button
                        variant="secondary"
                        onClick={handleShowMoreResults}
                        disabled={workerBusy}
                      >
                        Show More Results ({displayedResults.length} /{" "}
                        {validationResults.length})
                      </Button>
                    </CardFooter>
                  )}
                </ScrollArea>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
              style={{ height: "66%" }}
            >
              <Card className="flex-1 min-h-0 flex flex-col h-full border-[#1e007d]/20 dark:border-zinc-700 shadow-md dark:shadow-zinc-900/50 rounded-lg">
                <CardHeader className="flex-row justify-between items-center p-3 border-b border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                    <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">
                      CSV Data
                    </CardTitle>
                    {csvFileName && (
                      <span className="text-xs text-muted-foreground truncate">
                        ({csvFileName})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <TooltipProvider delayDuration={100}>
                      {" "}
                      <Tooltip>
                        {" "}
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveCsv();
                            }}
                            className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8"
                            disabled={!csvRawText.trim()}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>{" "}
                        <TooltipContent side="bottom">
                          <p>Save Edited CSV</p>
                        </TooltipContent>{" "}
                      </Tooltip>{" "}
                    </TooltipProvider>
                    {csvRawText.trim() && (
                      <TooltipProvider delayDuration={100}>
                        {" "}
                        <Tooltip>
                          {" "}
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearCsv();
                              }}
                              className="hover:bg-destructive/10 text-destructive h-8 w-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>{" "}
                          <TooltipContent side="bottom">
                            <p>Clear CSV Data</p>
                          </TooltipContent>{" "}
                        </Tooltip>{" "}
                      </TooltipProvider>
                    )}
                  </div>
                </CardHeader>

                <div className="flex flex-col items-center justify-center px-1 pt-1 pb-1">
                  {csvFileName ? (
                    <button
                      type="button"
                      onClick={handleUploadClick}
                      disabled={
                        isLoadingSchemaContent || workerBusy || isLoadingCsv
                      }
                      className={`w-8 h-8 flex items-center justify-center rounded border-2 border-dashed border-[#1e007d]/30 dark:border-zinc-600 bg-white/60 dark:bg-zinc-900/40 shadow-sm hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed ${csvFileName ? "border-green-400 bg-green-50/60 dark:bg-green-900/20" : ""}`}
                      tabIndex={0}
                      aria-label="Upload another CSV file"
                    >
                      <Upload className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleUploadClick}
                      disabled={
                        isLoadingSchemaContent || workerBusy || isLoadingCsv
                      }
                      className={`w-28 h-10 flex flex-col items-center justify-center rounded border-2 border-dashed border-[#1e007d]/30 dark:border-zinc-600 bg-white/60 dark:bg-zinc-900/40 shadow-sm hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed`}
                      tabIndex={0}
                    >
                      <Upload className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                      <span className="text-xs font-medium text-[#1e007d] dark:text-blue-200 mt-0.5">
                        Upload CSV
                      </span>
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
            <div
              className="min-h-0 flex flex-col flex-shrink-0 overflow-hidden"
              style={{ height: "34%" }}
            >
              <Card className="h-full flex flex-col border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg overflow-hidden">
                <CardHeader
                  className={cn(
                    "flex flex-row items-center justify-between p-3 border-b flex-shrink-0",
                    overallCsvStatus === "valid"
                      ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700"
                      : overallCsvStatus === "invalid"
                        ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
                        : "bg-[#1e007d]/5 dark:bg-zinc-800/50 border-[#1e007d]/10 dark:border-zinc-600",
                  )}
                >
                  <div className="flex items-center space-x-4">
                    {overallCsvStatus === "valid" ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : overallCsvStatus === "invalid" ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : overallCsvStatus === "pending" ? (
                      <FileText className="h-5 w-5 text-gray-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <CardTitle className="text-base font-semibold text-[#1e007d] dark:text-zinc-100">
                      Validation Results
                    </CardTitle>
                    {(totalErrorCount > 0 || totalWarningCount > 0) && (
                      <span className="text-lg text-muted-foreground font-bold">
                        (
                        {totalErrorCount > 0 ? `${totalErrorCount} Errors` : ""}
                        {totalErrorCount > 0 && totalWarningCount > 0
                          ? ", "
                          : ""}
                        {totalWarningCount > 0
                          ? `${totalWarningCount} Warnings`
                          : ""}
                        )
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {overallCsvStatus === "valid" && (
                      <span className="flex items-center text-green-700 dark:text-green-300 font-bold text-base bg-green-50 dark:bg-green-900/40 px-3 py-1 rounded-full">
                        <CheckCircle className="h-5 w-5 mr-1 text-green-500" />
                        Success: Data is valid!
                      </span>
                    )}
                    {overallCsvStatus === "invalid" && (
                      <span className="flex items-center text-red-700 dark:text-red-300 font-bold text-base bg-red-50 dark:bg-red-900/40 px-3 py-1 rounded-full">
                        <XCircle className="h-5 w-5 mr-1 text-red-500" />
                        Invalid data
                      </span>
                    )}
                    <TooltipProvider delayDuration={100}>
                      {" "}
                      <Tooltip>
                        {" "}
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyResults}
                            disabled={validationResults.length === 0}
                            className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>{" "}
                        <TooltipContent side="bottom">
                          <p>Copy Results</p>
                        </TooltipContent>{" "}
                      </Tooltip>{" "}
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <ScrollArea className="h-full" type="auto">
                  <CardContent className="p-0 h-full overflow-auto">
                    <div
                      style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                      }}
                    >
                      {displayedResults.length === 0 && !workerBusy && (
                        <div className="flex items-center justify-center p-10 text-muted-foreground">
                          {overallCsvStatus === "pending"
                            ? "Upload CSV and click Validate."
                            : "No issues found."}
                        </div>
                      )}
                      {workerBusy && (
                        <div className="flex items-center justify-center p-10 text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                          Validating...
                        </div>
                      )}
                      <ValidationResults
                        results={displayedResults}
                        openAccordionValue={openAccordionValue}
                        setOpenAccordionValue={setOpenAccordionValue}
                        setHighlightedCsvLine={setHighlightedCsvLine}
                        setScrollToLine={setScrollToLine}
                      />
                    </div>
                  </CardContent>
                  {validationResults.length > visibleResultCount && (
                    <CardFooter className="p-3 border-t border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0 justify-center">
                      <Button
                        variant="secondary"
                        onClick={handleShowMoreResults}
                        disabled={workerBusy}
                      >
                        Show More Results ({displayedResults.length} /{" "}
                        {validationResults.length})
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
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={jsonInputRef}
        onChange={handleSchemaUpload}
        accept=".json, application/json"
        style={{ display: "none" }}
      />
    </div>
  );
}
