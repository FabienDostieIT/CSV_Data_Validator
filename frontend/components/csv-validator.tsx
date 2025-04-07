"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import CodeEditor from "@/components/code-editor"
import ThemeToggle from "@/components/theme-toggle"
import { useTheme } from "@/components/theme-provider"
import { Check, Copy, Download, FileText, Upload, Loader2, CheckCircle, XCircle, AlertTriangle, X, ChevronDown } from "lucide-react"
import Papa from 'papaparse';
import { useVirtualizer } from '@tanstack/react-virtual';

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

export default function CsvValidator() {
    // --- State Variables ---
    const [availableSchemaNames, setAvailableSchemaNames] = useState<string[]>([]); // List of schema filenames
    const [selectedSchemaName, setSelectedSchemaName] = useState<string>(""); // Currently selected filename
    const [selectedSchemaContent, setSelectedSchemaContent] = useState<any>(''); // Should ideally be parsed JSON object or string
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
    const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false); // State for success animation
    const [showFailureOverlay, setShowFailureOverlay] = useState<boolean>(false); // State for failure animation
    const [overallCsvStatus, setOverallCsvStatus] = useState<'valid' | 'invalid' | 'pending' | 'error'>('pending');
    const [openAccordionValue, setOpenAccordionValue] = useState<string | undefined>(undefined); // State to track the open accordion item

    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

    const { toast } = useToast();
    const { theme } = useTheme();
    const workerRef = useRef<Worker | null>(null); // Ref for the worker
    const accumulatedResultsRef = useRef<RowValidationResults[]>([]); // Updated ref type

    // Ref for the scrollable element
    const parentRef = useRef<HTMLDivElement>(null);

    // Derived state for displayed results
    const displayedResults = validationResults.slice(0, visibleResultCount);

    // Update Virtualizer configuration
    const rowVirtualizer = useVirtualizer({
        count: displayedResults.length, // Use displayed results length
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50, // Adjust estimate as needed (trigger + content padding)
        overscan: 5,
        measureElement: (element) => {
             // Find the AccordionTrigger inside the measured element if needed for better height
            const trigger = element.querySelector('[data-state="closed"], [data-state="open"]'); 
            return trigger?.getBoundingClientRect().height || element.getBoundingClientRect().height;
         }
    });

    // --- Worker Setup and Cleanup ---
    useEffect(() => {
        // Create worker instance using URL constructor for bundling
        workerRef.current = new Worker(new URL('../workers/csv-validator.worker.js', import.meta.url), { type: 'module' });

        // Message handler
        workerRef.current.onmessage = (event) => {
          const { type, payload } = event.data;

          if (type === 'ready') {
            console.log("Component: Worker is ready.");
          } else if (type === 'resultsBatch') { // Updated message type
            console.log(`Component: Received results batch of size ${payload.results.length}`);
            // Accumulate combined results
            accumulatedResultsRef.current.push(...payload.results);
          } else if (type === 'complete') {
            console.log(`Component: Received complete message. Total errors: ${payload.totalErrors}, Total warnings: ${payload.totalWarnings}`);
            const finalResults = accumulatedResultsRef.current;
            setValidationResults(finalResults); // Set the full results
            setTotalErrorCount(payload.totalErrors);
            setTotalWarningCount(payload.totalWarnings);
            setVisibleResultCount(Math.min(20, finalResults.length)); // Reset visible count
            console.log(`Component: Updating state with final ${finalResults.length} row results.`);
            setOverallCsvStatus(payload.totalErrors === 0 ? 'valid' : 'invalid'); // Base overall status on errors only?
            setIsValidatingCsv(false);
            console.log("Component: Setting isValidatingCsv to false.");
            if (payload.totalErrors === 0 && payload.totalWarnings === 0) {
              toast({ title: "Validation Successful", description: "CSV data conforms to the selected schema with no warnings." });
              setShowSuccessOverlay(true);
              setTimeout(() => setShowSuccessOverlay(false), 2000);
            } else if (payload.totalErrors === 0 && payload.totalWarnings > 0) {
                toast({ variant: "default", title: "Validation Successful (with warnings)", description: `CSV data conforms to the schema, but ${payload.totalWarnings} warning(s) were generated. See results below.` });
                 // Optional: Show a different overlay or none for success with warnings?
            } else {
              toast({ variant: "destructive", title: "Validation Failed", description: `Found ${payload.totalErrors} error(s) and ${payload.totalWarnings} warning(s) in the CSV data. See results below.` });
              setShowFailureOverlay(true);
              setTimeout(() => setShowFailureOverlay(false), 2000);
            }
          } else if (type === 'error') {
            // Worker encountered an internal error
            console.error("Component: Worker error:", payload.message);
            toast({ variant: "destructive", title: "Validation Error", description: `An internal error occurred during validation: ${payload.message}` });
            console.log("Component: Setting isValidatingCsv to false due to worker error.");
            setIsValidatingCsv(false);
            setOverallCsvStatus('error');
            setTotalErrorCount(0); // Reset counts on error
            setTotalWarningCount(0);
            setVisibleResultCount(20); // Reset on error too
          }
        };

        // Error handler
        workerRef.current.onerror = (error) => {
          console.error("Component: Uncaught worker error:", error);
          toast({ variant: "destructive", title: "Worker Error", description: `Failed to load or run validation worker: ${error.message}` });
          setIsValidatingCsv(false);
          setOverallCsvStatus('error');
          console.log("Component: Setting isValidatingCsv to false due to worker onerror.");
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

      // --- Handlers ---

      const handleSchemaSelectionChange = (schemaName: string) => {
        if (schemaName) {
            setSelectedSchemaName(schemaName);
        }
      };

      const handleCsvUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }

        setIsLoadingCsv(true);
        setCsvFileName(file.name);
        setValidationResults([]); // Clear previous results
        setOverallCsvStatus('pending'); // Reset status
        toast({ title: "Parsing CSV", description: `Processing ${file.name}...` });

        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          setCsvRawText(text);

          Papa.parse<Record<string, any>>(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false, // Ensure values are parsed as strings initially
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

      const handleCsvDownload = () => {
        console.log("TODO: Implement CSV Download");
        toast({ title: "Info", description: "CSV Download not implemented yet." });
      };

      const handleUploadClick = () => {
        fileInputRef.current?.click(); // Trigger click on hidden input
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
                dynamicTyping: false, // Ensure values are parsed as strings initially here too
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


        // Reset UI state AND accumulated results ref
        setIsValidatingCsv(true);
        setValidationResults([]);
        accumulatedResultsRef.current = []; 
        setTotalErrorCount(0); 
        setTotalWarningCount(0);
        setVisibleResultCount(20); // Reset visible count here too!
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
            csvData: dataToValidate, 
            parsedSchema: parsedSchema 
          }
        });

      }, [selectedSchemaName, selectedSchemaContent, csvData, csvRawText, toast]);

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
        setValidationResults([]); // Clear results as well
        setOverallCsvStatus('pending'); // Reset status
        // Reset the file input so the same file can be re-uploaded if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setTotalErrorCount(0);
        setTotalWarningCount(0);
        setVisibleResultCount(20); // Reset on clear
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

      // --- JSX Structure Update ---
      return (
        <div className="container mx-auto p-4 md:p-6 flex flex-col min-h-screen gap-6">
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

          {/* Main Content Area - Removed padding, rely on grid gap */}
          <main className="flex-grow overflow-hidden">
            {/* Set height directly on grid container */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(60vh)]"> {/* Use calc if needed, or adjust vh */}
              {/* Left Panel: Schema Viewer */}
              <Card className="flex flex-col h-full border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg">
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
                   <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleCopySchema} disabled={!selectedSchemaContent} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-white h-8 w-8">
                        <Copy className="h-4 w-4" />
                      </Button>
                   </TooltipTrigger> <TooltipContent side="bottom"><p>Copy Schema</p></TooltipContent> </Tooltip> </TooltipProvider>
                 </div>
                {/* Schema Editor Content */}
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

              {/* Right Panel: CSV Data */} 
              <Card className="relative flex flex-col h-full border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg">
                 {/* Right Panel Header */} 
                 <CardHeader className="flex-row justify-between items-center bg-[#1e007d]/5 dark:bg-zinc-800/50 p-3 border-b border-[#1e007d]/10 dark:border-zinc-700">
                   <div className="flex items-center space-x-2">
                     <FileText className="h-5 w-5 text-[#1e007d] dark:text-blue-300" />
                     <CardTitle className="text-lg font-semibold text-[#1e007d] dark:text-zinc-100">CSV Data</CardTitle>
                   </div>
                   {/* --- Header Actions --- */}
                   <div className="flex items-center space-x-1">
                      {/* Upload */}
                      <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleUploadClick} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8" disabled={isLoadingCsv || isLoadingSchemaList || isLoadingSchemaContent || isValidatingCsv}>
                           {isLoadingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger> <TooltipContent side="bottom"><p>Upload CSV File</p></TooltipContent> </Tooltip> </TooltipProvider>

                      {/* Download */} 
                      <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleCsvDownload} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8" disabled={!csvRawText}> {/* Disable if no raw text */}
                           <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger> <TooltipContent side="bottom"><p>Download CSV</p></TooltipContent> </Tooltip> </TooltipProvider>
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

          {/* Results Section - Adjusted for Height and Clarity */}
          <section className="px-0 pb-4">
            <Card className="h-full border-[#1e007d]/20 dark:border-zinc-700 shadow-lg dark:shadow-zinc-900/50 rounded-lg overflow-hidden flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between bg-[#1e007d]/5 dark:bg-zinc-800/50 p-3 border-b border-[#1e007d]/10 dark:border-zinc-600 flex-shrink-0">
                <div className="flex items-center space-x-2">
                    {/* Dynamically update icon based on overall status? */}
                    {getStatusIcon(overallCsvStatus)}
                    <CardTitle className="text-lg font-semibold text-[#1e007d] dark:text-zinc-100">Validation Results</CardTitle>
                    {/* Show counts */} 
                    {(totalErrorCount > 0 || totalWarningCount > 0) && (
                        <span className="text-sm text-muted-foreground">
                            ({totalErrorCount > 0 ? `${totalErrorCount} Errors` : ''}
                            {totalErrorCount > 0 && totalWarningCount > 0 ? ', ' : ''}
                            {totalWarningCount > 0 ? `${totalWarningCount} Warnings` : ''})
                        </span>
                    )}
                </div>
                {/* Copy Button */} 
                <TooltipProvider delayDuration={100}> <Tooltip> <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleCopyResults} disabled={validationResults.length === 0} className="hover:bg-white/10 dark:hover:bg-zinc-700 text-[#1e007d] dark:text-zinc-300 h-8 w-8">
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger> <TooltipContent side="bottom"><p>Copy Results</p></TooltipContent> </Tooltip> </TooltipProvider>
              </CardHeader>
              <CardContent className="p-0 flex-grow overflow-hidden">
                 <ScrollArea ref={parentRef} className="h-full">
                   {/* Virtualized List */} 
                   <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                     {displayedResults.length === 0 && !isValidatingCsv && (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            {overallCsvStatus === 'pending' ? 'Upload CSV and click Validate.' : (validationResults.length > 0 ? '' : 'No issues found.') /* Adjust placeholder */}
                        </div>
                     )}
                     {isValidatingCsv && (
                         <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</div>
                     )}
                     {displayedResults.length > 0 && (
                       rowVirtualizer.getVirtualItems().map((virtualRow) => {
                         const result = displayedResults[virtualRow.index]; 
                         const rowSeverity = result.errors.length > 0 ? 'error' : 'warning';

                         return (
                           <div
                             key={result.row}
                             data-index={virtualRow.index}
                             ref={rowVirtualizer.measureElement}
                             style={{
                               position: 'absolute',
                               top: 0,
                               left: 0,
                               width: '100%',
                               transform: `translateY(${virtualRow.start}px)`,
                               padding: '0' // Apply padding within Accordion
                             }}
                           >
                             <Accordion 
                                type="single"
                                collapsible
                                className="w-full border-b border-muted/20 px-4"
                                value={openAccordionValue} 
                                onValueChange={setOpenAccordionValue}
                              >
                                <AccordionItem
                                    value={`item-${result.row}`}
                                    className="border-b-0"
                                 > 
                                    <AccordionTrigger className={`text-sm text-left hover:no-underline py-2 group ${rowSeverity === 'error' ? 'data-[state=open]:text-red-700 dark:data-[state=open]:text-red-300' : 'data-[state=open]:text-yellow-700 dark:data-[state=open]:text-yellow-300'}`}>
                                    <div className="flex items-center space-x-2 flex-grow truncate">
                                        {rowSeverity === 'error' ? 
                                           <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" /> : 
                                           <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                                        <span className="font-semibold">Row {result.row}:</span>
                                        <span className="truncate flex-grow text-muted-foreground">
                                            {result.errors[0]?.message || result.warnings[0]?.message || 'Unknown issue'}
                                            {(result.errors.length + result.warnings.length) > 1 ? ` (+${result.errors.length + result.warnings.length - 1} more)` : ''}
                                        </span>
                                    </div>
                                     <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180 flex-shrink-0 ml-2" />
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
                           </div>
                         );
                       })
                     )}
                   </div>
                 </ScrollArea>
              </CardContent>
                {/* Footer for Load More button */} 
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
            </Card>
          </section>

          {/* Hidden File Input */}
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