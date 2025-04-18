// Minimal API client for validation
export async function validateJson(schemaUrl: string, jsonData: any) {
  const response = await fetch("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemaUrl, jsonData }),
  });
  return response.json();
}

export async function getAvailableSchemas() {
  const response = await fetch("/api/schemas");
  return response.json();
}
