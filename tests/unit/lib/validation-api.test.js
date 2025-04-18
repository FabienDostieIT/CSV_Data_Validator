/**
 * Tests for the validation API client
 */
import { validateJson, getAvailableSchemas } from "../../../lib/validation-api";

// Mock the global fetch function
global.fetch = jest.fn();

describe("validation-api client", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("validateJson calls fetch with correct params and returns data", async () => {
    const mockResponse = { valid: true };
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(mockResponse) });
    const result = await validateJson("schema-url", { foo: "bar" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/validate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("getAvailableSchemas calls fetch and returns data", async () => {
    const mockSchemas = [{ id: 1, name: "Test" }];
    fetch.mockResolvedValueOnce({ json: () => Promise.resolve(mockSchemas) });
    const result = await getAvailableSchemas();
    expect(fetch).toHaveBeenCalledWith("/api/schemas");
    expect(result).toEqual(mockSchemas);
  });
});
