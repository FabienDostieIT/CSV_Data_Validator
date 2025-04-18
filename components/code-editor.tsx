"use client"

import { useEffect, useRef } from "react"
import Editor, { Monaco } from "@monaco-editor/react"
import { useTheme } from "@/components/theme-provider"
import * as monaco from 'monaco-editor';

// Define the structure for error decorations
export interface EditorErrorDecoration {
  range: monaco.IRange;
  message: string;
}

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string
  className?: string
  readOnly?: boolean
  errorDecorations?: EditorErrorDecoration[] // Changed from errorLines: number[]
  highlightedLine?: number // New prop for line highlighting
  scrollToLine?: number // New prop for auto-scroll
}

export default function CodeEditor({
  value,
  onChange,
  language = "json",
  height = "500px",
  className,
  readOnly = false,
  errorDecorations = [], // Changed from errorLines
  highlightedLine,
  scrollToLine,
}: CodeEditorProps) {
  const { theme } = useTheme()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationsRef = useRef<string[]>([])

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: Monaco
  ) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance

    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      wrappingIndent: 'indent',
      automaticLayout: true,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      tabSize: 2,
      readOnly: readOnly,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 10,
      // Enable hover options
      hover: {
        enabled: true,
        delay: 300, // Optional: Delay before hover appears
      }
    })

    applyErrorDecorations(errorDecorations)
  }

  // Updated function to apply precise decorations with hover messages
  const applyErrorDecorations = (decorations: EditorErrorDecoration[]) => {
    if (!editorRef.current || !monacoRef.current) return

    const newDecorations = decorations.map(dec => ({
      range: new monacoRef.current!.Range(
        dec.range.startLineNumber,
        dec.range.startColumn,
        dec.range.endLineNumber,
        dec.range.endColumn
      ),
      options: {
        // isWholeLine: false, // Don't highlight the whole line anymore
        className: 'editor-error-squiggly', // Class for squiggly underline
        glyphMarginClassName: 'editor-error-glyph',
        hoverMessage: { value: dec.message }, // Show error message on hover
        overviewRuler: {
          color: 'rgba(255, 0, 0, 0.7)',
          position: monacoRef.current!.editor.OverviewRulerLane.Right // Changed position for better visibility
        }
      }
    }))

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      newDecorations
    )
  }

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: readOnly })
    }
  }, [readOnly])

  useEffect(() => {
    applyErrorDecorations(errorDecorations)
  }, [errorDecorations]) // Changed dependency

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    // Always clear previous highlight
    const model = editorRef.current.getModel();
    if (model) {
      const allDecorations = model.getAllDecorations();
      const highlightDecorations = allDecorations.filter(d => d.options.className === 'editor-highlight-line');
      const highlightIds = highlightDecorations.map(d => d.id);
      editorRef.current.deltaDecorations(highlightIds, []);
    }
    if (highlightedLine) {
      editorRef.current.deltaDecorations([], [
        {
          range: new monacoRef.current.Range(highlightedLine, 1, highlightedLine, 1),
          options: {
            isWholeLine: true,
            className: 'editor-highlight-line',
          }
        }
      ]);
    }
  }, [highlightedLine]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    if (scrollToLine) {
      editorRef.current.revealLineInCenter(scrollToLine);
    }
  }, [scrollToLine]);

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  return (
    <div className={`relative ${className || ''}`} style={{ height }}>
      <style jsx global>{`
        /* Style for squiggly underline */
        .editor-error-squiggly {
          border-bottom: 1px wavy red;
        }
        /* Removed background highlight style */
        /* .editor-error-line {
          background-color: rgba(220, 38, 38, 0.1);
          border-left: 3px solid #dc2626;
        } */
        .editor-error-glyph {
          width: 5px !important;
          margin-left: 3px;
          background-color: #dc2626;
        }
        .monaco-editor .margin {
          background-color: ${theme === 'dark' ? '#1e1e1e' : '#f3f4f6'};
        }
        .monaco-editor .glyph-margin {
          background-color: ${theme === 'dark' ? '#1e1e1e' : '#f3f4f6'};
        }
        /* Ensure hover messages are styled appropriately */
        .monaco-hover-content {
          background-color: ${theme === 'dark' ? '#252526' : '#ffffff'};
          border: 1px solid ${theme === 'dark' ? '#454545' : '#c8c8c8'};
          color: ${theme === 'dark' ? '#cccccc' : '#333333'};
          padding: 4px 8px;
          border-radius: 3px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        /* Style for highlighted line */
        .editor-highlight-line {
          background-color: rgba(56, 189, 248, 0.15) !important; // much less opaque
          border-left: 2px solid #38bdf8 !important;
          z-index: 10;
          pointer-events: none; // allow editing even when highlighted
        }
      `}</style>
      <Editor
        height={height}
        language={language}
        theme={editorTheme}
        value={value}
        onChange={(newValue) => onChange(newValue || "")}
        onMount={handleEditorDidMount}
        options={{
          renderLineHighlight: "none",
        }}
      />
    </div>
  )
}

