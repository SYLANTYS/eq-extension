console.log("[CONTENT] Content script loaded on:", location.href);

// Monitor for the thank-you page and capture Supabase auth tokens
if (
  location.href.includes("airs-audio-system.vercel.app/thankyou") ||
  location.href.includes("airs-audio-system.vercel.app/login")
) {
  console.log(
    "[CONTENT] Detected thank-you/login page, scanning for Supabase tokens...",
  );

  // Find localStorage keys starting with "sb-" (Supabase auth keys)
  const sbKeys = Object.keys(localStorage).filter((key) =>
    key.startsWith("sb-"),
  );

  if (sbKeys.length > 0) {
    console.log("[CONTENT] Found Supabase keys:", sbKeys);

    for (const key of sbKeys) {
      try {
        const data = JSON.parse(localStorage.getItem(key));

        // Check if this object contains access_token and refresh_token
        if (data?.access_token && data?.refresh_token) {
          console.log("[CONTENT] Found tokens in key:", key);

          // Send tokens to background service worker
          chrome.runtime.sendMessage(
            {
              type: "CAPTURE_AUTH_TOKENS",
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[CONTENT] Failed to send tokens to background:",
                  chrome.runtime.lastError,
                );
                return;
              }

              if (response?.ok) {
                console.log(
                  "[CONTENT] Tokens successfully captured by background, cleaning up website storage...",
                );

                // Delete the token object from website localStorage
                localStorage.removeItem(key);
                console.log(
                  "[CONTENT] Removed token object from website storage",
                );
              } else {
                console.error(
                  "[CONTENT] Background failed to capture tokens:",
                  response?.error,
                );
              }
            },
          );

          break; // Exit after processing first valid token object
        }
      } catch (e) {
        console.warn("[CONTENT] Error parsing localStorage key", key, ":", e);
      }
    }
  } else {
    console.log(
      "[CONTENT] No Supabase keys found in localStorage on thank-you page",
    );
  }
}
