// src/functions/auth/[...auth].ts
import { Auth } from "@auth/core";
import { getAuthConfig } from "../../lib/auth"; // Import the function that returns AuthConfig
import type { APIContext } from "astro";
import type { RuntimeEnv } from "../../env.d"; // To ensure runtimeEnv typing

// Astro API routes (including those in `src/functions`) receive an APIContext object.
export const onRequest = async (context: APIContext): Promise<Response> => {
  const { request, locals } = context;

  // Ensure the runtime environment is available.
  // In Astro's Cloudflare integration, `locals.runtime.env` should be populated.
  const runtimeEnv = locals.runtime?.env as RuntimeEnv | undefined;

  if (!runtimeEnv) {
    console.error(
      "FATAL: Runtime environment not available in [...auth].ts handler. Auth.js cannot be initialized."
    );
    // Return a generic error response. In a real scenario, you might have a more structured error page or response.
    return new Response(
      "Authentication service is currently unavailable due to a configuration error.",
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }

  // Generate the Auth.js configuration dynamically using the runtime environment.
  // This ensures the D1Adapter and AUTH_SECRET are correctly initialized.
  const authConfig = getAuthConfig(runtimeEnv);

  // Pass the original request and the dynamically generated authConfig to the Auth.js core handler.
  // Auth() will handle the rest: parsing the request, interacting with providers/adapter,
  // and returning the appropriate Response (e.g., redirect, JSON data, cookies).
  try {
    const response = await Auth(request, authConfig);
    return response;
  } catch (error: any) {
    // Catch any unexpected errors during Auth() processing.
    // Auth.js itself usually returns a Response, even for errors (e.g., redirect to error page).
    // This catch block is for truly unexpected exceptions.
    console.error("Unexpected error in Auth.js core processing in [...auth].ts:", error);

    // It's generally safer to return a generic error or redirect to your auth error page.
    // Avoid exposing detailed error messages unless in development.
    if (runtimeEnv.ENVIRONMENT === "development") {
      return new Response(
        `Auth processing error: ${error.message || "Unknown error"}`,
        { status: 500 }
      );
    }
    
    // For production, redirect to a generic error page or the configured Auth.js error page.
    const errorPageUrl = new URL(authConfig.pages?.error || "/auth/error", request.url);
    errorPageUrl.searchParams.set("error", "ConfigurationError"); // Or a more generic error code
    
    // Create a new Response for the redirect
    return new Response(null, {
        status: 302, // Or 307 if you prefer
        headers: {
            'Location': errorPageUrl.toString()
        }
    });
  }
};