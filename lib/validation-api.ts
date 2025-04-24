import { ValidationResponse } from "@/types/validation";

// Minimal API client for validation
// export async function validateJson(
//   schema: string,
//   data: unknown,
// ): Promise<any> {
//   const url = "/api/validate"; // This route does not exist
//   try {
//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ schema, data }),
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const result = await response.json();
//     return result;
//   } catch (error) {
//     console.error("Error validating JSON:", error);
//     throw error;
//   }
// }

/**
 * Fetches the list of available schemas from the API.
 * @returns A promise that resolves to an array of schema names.
 */
export async function getAvailableSchemas(): Promise<string[]> {
  const url = "/api/schemas"; // Adjust if your API endpoint is different
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as { schemas?: unknown[] };

    // Basic type check
    if (!data || typeof data !== "object" || !Array.isArray(data?.schemas)) {
      console.error("Invalid response format from /api/schemas:", data);
      throw new Error("Invalid response format from API.");
    }

    // Ensure all elements in the array are strings
    const schemas = (data as { schemas: unknown[] }).schemas;
    if (!schemas.every((item): item is string => typeof item === "string")) {
      console.error("Invalid schema array format:", schemas);
      throw new Error("Invalid schema array format received from API.");
    }

    return schemas;
  } catch (error) {
    console.error("Error fetching schemas:", error);
    throw error;
  }
}

export function validateJsonSchema(): Promise<ValidationResponse> {
  // Implementation of validateJsonSchema
  // Placeholder implementation to avoid empty block error if applicable
  throw new Error("validateJsonSchema not implemented.");
}

export function validateCsvAgainstSchema(): Promise<ValidationResponse> {
  // Implementation of validateCsvAgainstSchema
  // Placeholder implementation to avoid empty block error if applicable
  throw new Error("validateCsvAgainstSchema not implemented.");
}
