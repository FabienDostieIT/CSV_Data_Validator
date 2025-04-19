/**
 * Tests for the validation API client
 */
import { getAvailableSchemas } from "../../../lib/validation-api";

// Mock the global fetch function
global.fetch = jest.fn();

describe("validation-api client", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Commenting out test for non-existent/commented-out function
  /*
  it("validateJson calls fetch with correct params and returns data", async () => {
    const mockResponse = { valid: true };
    // Mock fetch to return a Response-like object with ok: true
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, 
      json: () => Promise.resolve(mockResponse)
    });
    const result = await validateJson("schema-url", { foo: "bar" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/validate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResponse);
  });
  */

  it("getAvailableSchemas calls fetch and returns data", async () => {
    // Correct mock data to be string[]
    const mockSchemas: string[] = ["schema1.json", "schema2.json"];
    // Mock fetch to return a Response-like object with ok: true
    (global.fetch as jest.Mock).mockResolvedValueOnce({ 
      ok: true, 
      json: () => Promise.resolve({ schemas: mockSchemas }) // Ensure nested structure matches API
    });
    const result = await getAvailableSchemas();
    expect(fetch).toHaveBeenCalledWith("/api/schemas");
    expect(result).toEqual(mockSchemas);
  });
});
