/**
 * API client for fetching schema data that works in both development (dynamic API)
 * and production (static JSON files) environments.
 */

// Define the schema object interface for better typing
export interface SchemaObject {
  name: string;
  filename: string;
}

// Define interface for schema property details
interface SchemaPropertyDetails {
  description?: string;
  type?: string;
  examples?: unknown[];
  [key: string]: unknown;
}

/**
 * Gets the base URL for API requests, adjusting for GitHub Pages in production
 */
const getApiBase = () => {
  // Determine if this is a GitHub Pages specific build
  const isGithubPagesBuild = process.env.GITHUB_PAGES_BUILD === 'true';

  // Use GitHub Pages path ONLY when specifically building for GitHub Pages
  if (isGithubPagesBuild) {
    return "/JSON_Schema_Validator/api";
  }
  // In all other cases (development, Vercel, CI tests, standard prod builds)
  return "/api";
};

/**
 * Fetches the list of available schemas
 * @returns {Promise<SchemaObject[]>}
 */
export async function getSchemasList(): Promise<SchemaObject[]> {
  // Always use the API route, which works in both environments
  const url = "/api/list-schemas";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as SchemaObject[];
  } catch (error) {
    console.error("Error fetching schemas list:", error);
    throw error;
  }
}

/**
 * Fetches a specific schema by name
 * @param {string} schemaName - The name of the schema to fetch
 * @returns {Promise<Record<string, unknown>>} - The schema object
 */
export async function getSchemaByName(
  schemaName: string,
): Promise<Record<string, unknown>> {
  // Ensure no .json extension and remove any path traversal
  const safeSchemaName = schemaName
    .replace(/\.json$/, "")
    .replace(/[^\w-]/g, "");

  // Determine the correct URL based on environment
  const isGithubPagesBuild = process.env.GITHUB_PAGES_BUILD === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  // Use static paths for GitHub Pages build, dynamic API otherwise
  const url = isGithubPagesBuild
    ? `${getApiBase()}/schemas/${safeSchemaName}.json` // /JSON_Schema_Validator/api/schemas/...json
    : isProduction
      ? `/api/get-schema/${safeSchemaName}` // Use API route in regular production (Vercel)
      : `/schemas/v1/${safeSchemaName}.json`; // Dev fetches directly from public/schemas/v1

  console.log(`[getSchemaByName] Fetching schema from URL: ${url}`); // Debug logging

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    console.error(`Error fetching schema ${schemaName}:`, error);
    throw error;
  }
}

/**
 * Generate a basic markdown representation of a schema object on the client side
 * This is used as a fallback when the API endpoint is not available
 *
 * @param {Record<string, unknown>} schema - The schema object
 * @returns {string} - The generated markdown
 */
function generateClientSideMarkdown(schema: Record<string, unknown>): string {
  const title = (schema.title as string) || "JSON Schema";
  const description =
    (schema.description as string) || "No description available";

  let markdown = `# ${title}\n\n${description}\n\n`;

  if (schema.properties && typeof schema.properties === "object") {
    markdown += "## Properties\n\n";

    for (const [propName, propDetails] of Object.entries(
      schema.properties as Record<string, SchemaPropertyDetails>,
    )) {
      markdown += `### ${propName}\n\n`;

      if (propDetails.description) {
        markdown += `${propDetails.description}\n\n`;
      }

      if (propDetails.type) {
        markdown += `**Type**: ${propDetails.type}\n\n`;
      }

      if (
        propDetails.examples &&
        Array.isArray(propDetails.examples) &&
        propDetails.examples.length > 0
      ) {
        markdown += `**Example**: \`${JSON.stringify(propDetails.examples[0])}\`\n\n`;
      }
    }
  }

  return markdown;
}

/**
 * Generate documentation for a schema
 * Uses API endpoint in development mode with a fallback to client-side generation
 * Uses client-side generation in production mode
 *
 * @param {Record<string, unknown>} schema - The schema object
 * @returns {Promise<{markdown: string}>}
 */
export async function generateSchemaDocumentation(
  schema: Record<string, unknown>,
): Promise<{ markdown: string }> {
  // Generate on client side if building for GitHub Pages or in production (Vercel)
  const isClientSideGeneration =
    process.env.GITHUB_PAGES_BUILD === 'true' || process.env.NODE_ENV === "production";

  if (isClientSideGeneration) {
    console.log(
      "Generating schema documentation on the client side (Prod/GitHub Pages)",
    );
    try {
      return { markdown: generateClientSideMarkdown(schema) };
    } catch (error) {
      console.error(
        "Error generating client-side schema documentation:",
        error,
      );
      return {
        markdown: `# Error Generating Documentation\n\nCould not generate documentation for the schema in static mode.`,
      };
    }
  }

  // In development, try the API endpoint first, fallback to client-side if unavailable
  console.log("Attempting to generate schema documentation via API (Dev)");
  try {
    // Use the absolute path to ensure the request works correctly
    const url = "/api/generate-schema-doc";

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as { markdown: string };
  } catch (error) {
    console.error("Error fetching schema documentation:", error);

    // Check if it's a network error (connection refused)
    if (
      error instanceof Error &&
      (error.message.includes("Failed to fetch") ||
        error.message.includes("Network Error") ||
        error.message.includes("Connection refused"))
    ) {
      console.log(
        "API endpoint unavailable, falling back to client-side generation",
      );

      // Fall back to client-side generation
      try {
        return { markdown: generateClientSideMarkdown(schema) };
      } catch (fallbackError) {
        console.error("Error in client-side fallback:", fallbackError);
      }
    }

    // If not a network error or client-side fallback failed, return error message
    return {
      markdown: `# Error Loading Documentation\n\n${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
