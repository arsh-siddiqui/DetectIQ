export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error("Please enter a URL.");
  }
  
  let urlStr = input.trim();
  
  if (!urlStr) {
    throw new Error("Please enter a URL.");
  }

  if (urlStr.includes(" ")) {
    throw new Error("Invalid URL format.");
  }

  if (urlStr.toLowerCase().startsWith("javascript:")) {
    throw new Error("Unsupported protocol.");
  }

  // Prepend https:// if no protocol is provided
  if (!urlStr.match(/^[a-zA-Z]+:\/\//)) {
    urlStr = "https://" + urlStr;
  }

  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported protocol.");
    }
    
    if (parsed.hostname !== "localhost" && !parsed.hostname.includes(".")) {
      throw new Error("Invalid domain format.");
    }
    
    // Ensure we return a clean href without altering the parsed URL logic
    return parsed.href;
  } catch (err) {
    if (err.message.includes("Unsupported protocol") || err.message.includes("Invalid domain")) {
      throw err;
    }
    throw new Error("Invalid URL format.");
  }
}
