"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Check, Copy, Download, FileText, Upload, Save, FolderOpen, Trash2, Plus, Loader2, CheckCircle, XCircle, AlertTriangle, ToggleLeft, ToggleRight, FileJson, Link, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import CodeEditor, { EditorErrorDecoration } from "@/components/code-editor"
import ThemeToggle from "@/components/theme-toggle"
import { useTheme } from "@/components/theme-provider"
import * as jsonc from 'jsonc-parser'
import Papa from 'papaparse'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Placeholder schemas for dropdown (to be replaced with dynamic loading)
const availableSchemas: Record<string, string> = {
  'event.json': JSON.stringify({ "$schema": "http://json-schema.org/draft-07/schema#", "title": "Event Schema Placeholder" /* ... */ }, null, 2),
  'place.json': JSON.stringify({ "$schema": "http://json-schema.org/draft-07/schema#", "title": "Place Schema Placeholder" /* ... */ }, null, 2),
};

const defaultSchemaSelection = 'event.json';

// Keep IRange for potential use with CSV editor highlighting
interface IRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

// Define a type for our formatted errors
interface FormattedValidationError {
  row: number;
  path: string; // JSON path within the row object (cleaned, no leading '/')
  message: string; // Potentially enhanced message
}

export default function CsvValidator() {
  // --- State Variables ---
  const [availableSchemaNames, setAvailableSchemaNames] = useState<string[]>([]); // List of schema filenames
  const [selectedSchemaName, setSelectedSchemaName] = useState<string>(""); // Currently selected filename
  const [selectedSchemaContent, setSelectedSchemaContent] = useState<any>(''); // Should ideally be parsed JSON object or string
  const [csvRawText, setCsvRawText] = useState<string>("");
  const [csvData, setCsvData] = useState<Record<string, any>[]>([]);
  const [csvViewMode, setCsvViewMode] = useState<'raw' | 'grid'>('raw');
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [isLoadingSchemaList, setIsLoadingSchemaList] = useState<boolean>(true);
  const [isLoadingSchemaContent, setIsLoadingSchemaContent] = useState<boolean>(false);
  const [isValidatingCsv, setIsValidatingCsv] = useState<boolean>(false);
  const [isLoadingCsv, setIsLoadingCsv] = useState<boolean>(false);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [validationResults, setValidationResults] = useState<FormattedValidationError[]>([]);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false); // State for success animation
  const [showFailureOverlay, setShowFailureOverlay] = useState<boolean>(false); // State for failure animation

  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

  const { toast } = useToast();
  const { theme } = useTheme();
  const workerRef = useRef<Worker | null>(null); // Ref for the worker

  // --- Worker Setup and Cleanup ---
  useEffect(() => {
    // Create worker instance
    workerRef.current = new Worker('/csv-validator.worker.js'); // Path relative to public folder

    // Message handler
    workerRef.current.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'errorBatch') {
        // Append errors incrementally
        setValidationResults(prevErrors => [...prevErrors, ...payload]);
      } else if (type === 'complete') {
        const { totalErrors } = payload;
        setIsValidatingCsv(false); // Validation finished

        if (totalErrors === 0) {
          // Success Case
          toast({ title: "Validation Successful", description: "CSV data conforms to the selected schema." });
          setShowSuccessOverlay(true);
          setTimeout(() => setShowSuccessOverlay(false), 2000);
        } else {
          // Data Validation Failure Case
          toast({ variant: "destructive", title: "Validation Failed", description: `Found ${totalErrors} error(s) in the CSV data. See results below.` });
           setShowFailureOverlay(true);
           setTimeout(() => setShowFailureOverlay(false), 2000);
        }
      } else if (type === 'error') {
        // Worker encountered an internal error
        console.error("Worker Error:", payload.message);
        toast({ variant: "destructive", title: "Validation Error", description: `An internal error occurred during validation: ${payload.message}` });
        setIsValidatingCsv(false);
      }
    };

    // Error handler
    workerRef.current.onerror = (error) => {
      console.error("Worker Error Event:", error);
      toast({ variant: "destructive", title: "Worker Error", description: "Failed to load or run the validation worker." });
      setIsValidatingCsv(false);
    };

    // Cleanup on component unmount
    return () => {
      console.log("Terminating worker");
      workerRef.current?.terminate();
    };
  }, [toast]); // Add toast dependency

  // --- Effect to fetch schema list on mount ---
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

  // --- Effect to fetch schema content when selection changes ---
  useEffect(() => {
    if (!selectedSchemaName) {
      setSelectedSchemaContent('');
      setValidationResults([]);
      return;
    }

    const fetchSchemaContent = async () => {
      setIsLoadingSchemaContent(true);
      setValidationResults([]);
      try {
        const response = await fetch(`/api/schemas/${selectedSchemaName}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSelectedSchemaContent(data.content);
        toast({ title: "Success", description: `Schema '${selectedSchemaName}' loaded.` });
      } catch (error) {
        console.error("Error fetching schema content:", error);
        toast({ variant: "destructive", title: "Error", description: `Failed to load schema '${selectedSchemaName}'.` });
        setSelectedSchemaContent('');
      }
      setIsLoadingSchemaContent(false);
    };

    fetchSchemaContent();
  }, [selectedSchemaName, toast]);

  // --- Handlers (Keep placeholders, update schema selection) ---

  const handleSchemaSelectionChange = (schemaName: string) => {
    if (schemaName) {
        setSelectedSchemaName(schemaName);
    }
  };

  // Keep other handlers as placeholders
  const handleCsvUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsLoadingCsv(true);
    setCsvFileName(file.name);
    setValidationResults([]); // Clear previous results

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvRawText(text);

      Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
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
                path: `CSV Header/Parse Error (Row ${errorRow})`,
                message: errorMessage, // Use checked/defaulted message
              },
            ]);
            setCsvData([]);
          } else {
            setCsvData(results.data);
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
              path: 'CSV Parsing Failed',
              message: error.message,
            },
          ]);
          setCsvData([]);
          setIsLoadingCsv(false);
        },
      });
    };
    reader.readAsText(file);
  }, [toast]); // Add toast dependency if used inside

  const handleCsvDownload = () => {
    console.log("TODO: Implement CSV Download");
    toast({ title: "Info", description: "CSV Download not implemented yet." });
  };
  const handleCsvRawTextChange = (value: string | undefined) => {
    const text = value || "";
    setCsvRawText(text);
    console.log("TODO: Debounce parse CSV raw text:", text.substring(0, 50) + "...");
  };
  const handleValidateCsv = () => {
    console.log("TODO: Implement CSV Validation");
    setIsValidatingCsv(true);
    setTimeout(() => {
       toast({ title: "Info", description: "CSV Validation not implemented yet." });
       setValidationErrors([
         { row: 2, column: 'email', message: 'should be a valid email address' },
         { row: 5, column: 'quantity', message: 'should be a number >= 0' }
       ]);
       setIsValidatingCsv(false);
    }, 1000);
  };
  const handleToggleCsvView = () => {
    setCsvViewMode(prev => prev === 'raw' ? 'grid' : 'raw');
  };
  const handleCopyResults = () => {
    const resultsText = JSON.stringify(validationErrors, null, 2);
    navigator.clipboard.writeText(resultsText).then(() => {
      toast({ title: "Results Copied!", description: "Validation results copied to clipboard." });
    }, (err) => {
      toast({ title: "Copy Failed", description: "Could not copy results.", variant: "destructive" });
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click(); // Trigger click on hidden input
  };

  // Add back empty function definitions to satisfy onClick handlers
  const handleLinkAction = () => {
    console.log("TODO: Implement Link Action");
    // Placeholder or leave empty
  };

  const performCsvValidation = useCallback(async () => {
    // Basic checks before starting worker
    if (!workerRef.current) {
      toast({ variant: "destructive", title: "Error", description: "Validation worker not initialized." });
      return;
    }
     if (!selectedSchemaName || !selectedSchemaContent) {
       toast({ variant: "destructive", title: "Error", description: "Please select a schema first." });
       return;
     }
     if (csvData.length === 0 && !csvRawText.trim()) { // Check both raw and parsed
       toast({ variant: "destructive", title: "Error", description: "No CSV data loaded to validate." });
       return;
     }
     // If we have raw text but no csvData (e.g., user edited raw), re-parse first
     // Note: This parse happens on main thread, could be moved to worker too if needed
     let dataToValidate = csvData;
     if (dataToValidate.length === 0 && csvRawText.trim()) {
        const parseResult = Papa.parse<Record<string, any>>(csvRawText, {
            header: true,
            skipEmptyLines: true,
        });
        if (parseResult.errors.length > 0) {
             toast({ variant: "destructive", title: "CSV Parse Error", description: `Cannot validate due to CSV parse errors: ${parseResult.errors[0].message}` });
             return;
        }
        dataToValidate = parseResult.data;
        setCsvData(dataToValidate); // Update state if reparsed
     }
     if (dataToValidate.length === 0){
        toast({ variant: "destructive", title: "Error", description: "CSV data is empty after parsing." });
        return;
     }


    // Reset UI state
    setIsValidatingCsv(true);
    setValidationResults([]);
    setShowSuccessOverlay(false);
    setShowFailureOverlay(false);
    console.log("Component: Sending data to worker...");

    let parsedSchema: any;
    try {
      // Ensure schema is parsed before sending
      parsedSchema = typeof selectedSchemaContent === 'string' ? JSON.parse(selectedSchemaContent) : selectedSchemaContent;
    } catch (err: any) {
      toast({ variant: "destructive", title: "Schema Error", description: `Failed to parse the selected schema JSON before sending to worker: ${err.message}` });
      console.error("Schema parsing error:", err);
      setIsValidatingCsv(false);
      return;
    }

    // Send data to worker
    workerRef.current.postMessage({
      type: 'validate',
      payload: {
        csvData: dataToValidate, // Send parsed data
        parsedSchema: parsedSchema // Send parsed schema
      }
    });

  }, [selectedSchemaName, selectedSchemaContent, csvData, csvRawText, toast]); // Added csvRawText

  // Add empty handleCopySchema definition
  const handleCopySchema = () => {
    console.log("TODO: Implement Copy Schema");
    // Placeholder or leave empty
  };

  // Implement handleClearCsv
  const handleClearCsv = useCallback(() => {
    setCsvRawText('');
    setCsvData([]);
    setCsvFileName('');
    setValidationResults([]); // Clear results as well
    // Reset the file input so the same file can be re-uploaded if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({ title: "Info", description: "CSV data cleared." });
  }, [toast]);

  // --- JSX Structure Update ---
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl flex flex-col min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#1e007d]/10 dark:border-zinc-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="https://cdn.prod.website-files.com/67d2f3ccf11ae5fe6c005b81/67d2f3ccf11ae5fe6c005b8b_logo.svg"
            alt="Company Logo"
            className="h-16 w-auto dark:filter dark:invert dark:brightness-0 dark:saturate-100"
          />
          <span className="text-2xl text-muted-foreground/50">|</span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
            CSV Data Validator
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 overflow-hidden">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left Panel: Schema Viewer - Update header bg, ensure Card styles */}
          <Card className="flex flex-col h-[60vh] border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg"> {/* Ensure rounded-lg and h-[60vh] */}
            {/* Update Header Div background */}
            <div className="flex items-center justify-between bg-[#1e007d]/5 dark:bg-zinc-800/50 p-3 border-b border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0">
               <Select
                   value={selectedSchemaName}
                   onValueChange={handleSchemaSelectionChange}
                   disabled={isLoadingSchemaList || availableSchemaNames.length === 0}
               >
                 <SelectTrigger className="w-[220px] bg-white/10 dark:bg-zinc-800/50 border-[#ffffff40] text-white focus:ring-white/50 data-[placeholder]:text-white/70 disabled:opacity-70 disabled:cursor-not-allowed">
                   <SelectValue placeholder={isLoadingSchemaList ? "Loading schemas..." : "Select Schema"} />
                 </SelectTrigger>
                 <SelectContent className="dark:bg-zinc-800">
                   {isLoadingSchemaList ? (
                       <SelectItem value="loading" disabled>Loading...</SelectItem>
                   ) : availableSchemaNames.length === 0 ? (
                       <SelectItem value="no-schemas" disabled>No schemas found</SelectItem>
                   ) : (
                       availableSchemaNames.map((name) => (
                           <SelectItem key={name} value={name} className="dark:focus:bg-zinc-700">
                             {name}
                           </SelectItem>
                       ))
                   )}
                 </SelectContent>
               </Select>
               {/* Add back copy button if it was here */} 
               <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleCopySchema} disabled={!selectedSchemaContent} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-white h-8 w-8">
                    <Copy className="h-4 w-4" />
                  </Button>
               </TooltipTrigger> <TooltipContent side="bottom"><p>Copy Schema</p></TooltipContent> </Tooltip> </TooltipProvider>
             </div>
            {/* Schema Editor Content (Keep as is) */}
            <CardContent className="flex-grow p-0">
              {isLoadingSchemaContent ? (
                <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading schema...</div>
              ) : (
                <CodeEditor
                  value={selectedSchemaContent || "// Select a schema to view its content"}
                  language="json"
                  readOnly={true}
                  height="100%"
                  onChange={() => {}} // Keep empty onChange
                />
              )}
            </CardContent>
          </Card>

          {/* Right Panel: CSV Data - Ensure Card styles */}
          <Card className="relative flex flex-col h-[60vh] border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg"> {/* Add relative */}
             {/* Right Panel Header - DO NOT TOUCH */}
             <CardHeader className="flex-row justify-between items-center bg-[#1e007d]/5 dark:bg-zinc-800/50 p-3 border-b border-[#1e007d]/10 dark:border-zinc-700">
               <div className="flex items-center space-x-2">
                 <FileText className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                 <CardTitle className="text-lg font-semibold text-[#1e007d] dark:text-zinc-100">CSV Data</CardTitle>
               </div>
               {/* --- Restore Header Actions --- */}
               <div className="flex items-center space-x-1">
                 {/* Link */}
                 <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={handleLinkAction} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8">
                     <Link className="h-4 w-4" />
                   </Button>
                 </TooltipTrigger> <TooltipContent side="bottom"><p>Link (Not Implemented)</p></TooltipContent> </Tooltip> </TooltipProvider>
                 
                 {/* Upload - Ensure onClick is handleUploadClick */}
                 <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={handleUploadClick} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8" disabled={isLoadingCsv || isLoadingSchemaList || isLoadingSchemaContent || isValidatingCsv}>
                      {isLoadingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                   </Button>
                 </TooltipTrigger> <TooltipContent side="bottom"><p>Upload CSV File</p></TooltipContent> </Tooltip> </TooltipProvider>
                 
                 {/* Download */}
                 <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={handleCsvDownload} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8">
                      <Download className="h-4 w-4" />
                   </Button>
                 </TooltipTrigger> <TooltipContent side="bottom"><p>Download CSV (Not Implemented)</p></TooltipContent> </Tooltip> </TooltipProvider>
               </div>
             </CardHeader>

            {/* CSV Editor Content - Add container for overlay */} 
            <CardContent className="flex-grow p-0 relative"> {/* Add relative */}
              <CodeEditor
                value={csvRawText}
                language="plaintext"
                readOnly={false} // Allow editing
                onChange={setCsvRawText}
                height="100%" // Keep height
              />
              {/* Success Overlay */} 
              {showSuccessOverlay && (
                <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex items-center justify-center z-10 transition-opacity duration-300 animate-fade-in">
                  <CheckCircle className="h-24 w-24 text-green-600" />
                </div>
              )}
              {/* Failure Overlay */}
              {showFailureOverlay && (
                <div className="absolute inset-0 bg-red-500/20 backdrop-blur-sm flex items-center justify-center z-10 transition-opacity duration-300 animate-fade-in">
                  <XCircle className="h-24 w-24 text-red-600" />
                </div>
              )}
            </CardContent>

            {/* Footer - Add Clear button */}
            <CardFooter className="flex justify-end items-center p-3 border-t border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0">
               {/* Left side: File name and clear button */}
               <div className="flex items-center space-x-1 flex-grow mr-4 truncate">
                 <span className="text-sm text-muted-foreground truncate">
                    {csvFileName || 'No file uploaded'}
                 </span>
                 {csvFileName && (
                    <TooltipProvider delayDuration={100}>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                             onClick={handleClearCsv}
                           >
                             <X className="h-4 w-4" />
                             <span className="sr-only">Clear uploaded CSV</span>
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent side="top">
                           <p>Clear uploaded CSV</p>
                         </TooltipContent>
                       </Tooltip>
                    </TooltipProvider>
                 )}
               </div>
               <Button
                 onClick={performCsvValidation}
                 disabled={isValidatingCsv || !csvRawText.trim() || !selectedSchemaName}
                 size="lg"
                 className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
               >
                 {isValidatingCsv ? (
                   <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</>
                 ) : (
                   "Validate Data"
                 )}
               </Button>
            </CardFooter>
          </Card>
        </section>
      </main>

      {/* Results Section - Update Header and List Item Display */}
      <section className="px-4 pb-4">
        <Card className="border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 border-b border-[#1e007d]/10 dark:border-zinc-700">
            <CardTitle className="text-base font-medium text-[#1e007d] dark:text-zinc-100">Validation Results {validationResults.length > 0 ? `(${validationResults.length} errors)` : ''}</CardTitle>
             {/* Add Copy Button for results */} 
             <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
               <Button variant="ghost" size="icon" onClick={handleCopyResults} disabled={validationResults.length === 0} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8">
                 <Copy className="h-4 w-4" />
               </Button>
             </TooltipTrigger> <TooltipContent side="bottom"><p>Copy Results</p></TooltipContent> </Tooltip> </TooltipProvider>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[200px]"> {/* Adjust height as needed */}
              <div className="p-4">
                {isValidatingCsv ? (
                  <div className="flex items-center justify-center text-sm text-muted-foreground h-[160px]"> {/* Added fixed height during load */}
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing data... Errors will appear here shortly.
                  </div>
                ) : validationResults.length > 0 ? (
                  // Replace UL with Accordion
                  <Accordion type="multiple" className="w-full">
                    {validationResults.map((err, index) => (
                      <AccordionItem value={`error-${index}`} key={index} className="border-b border-muted/20 last:border-b-0">
                        <AccordionTrigger className="text-sm text-left hover:no-underline px-4 py-2 text-red-600 dark:text-red-400">
                          <div className="flex items-center space-x-2 flex-grow">
                             <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                             <span className="font-semibold">Row {err.row}:</span>
                             <span className="truncate flex-grow">{err.path !== 'N/A' ? `${err.path} - ` : ''}{err.message.split('.')[0]}</span> {/* Show path and first part of message */} 
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground pt-1 pb-3 px-4 pl-10"> {/* Indent content */} 
                           <p><span className="font-semibold">Property:</span> {err.path || 'N/A'}</p>
                           <p><span className="font-semibold">Message:</span> {err.message}</p>
                         </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No data validation errors found.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      {/* Hidden File Input (Ensure it's still here) */}
       <input
         type="file"
         ref={fileInputRef}
         onChange={handleCsvUpload}
         accept=".csv, text/csv"
         style={{ display: 'none' }}
       />

    </div>
  )
} 