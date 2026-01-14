import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const KIWIX_SERVER_BASE = "http://localhost:8080"; // Default Kiwix server URL
const USER_AGENT = "kiwix-mcp-server/1.0";

// Create server instance
const server = new McpServer({
  name: "kiwix-wiki",
  version: "1.0.0"
});

// Helper function for making Kiwix API requests
async function makeKiwixRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(endpoint, KIWIX_SERVER_BASE);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/html",
  };

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error("Error making Kiwix request:", error);
    return null;
  }
}

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

interface LibraryInfo {
  name: string;
  id: string;
  title: string;
  description: string;
  language: string;
  date: string;
  size: string;
  articleCount: string;
  mediaCount: string;
}

// Helper function to extract text content from HTML
function extractTextFromHtml(html: string): string {
  // Simple HTML tag removal for basic text extraction
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Format search results
function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No results found.";
  }

  return results.map((result, index) => [
    `${index + 1}. **${result.title}**`,
    `   URL: ${result.url}`,
    result.snippet ? `   Preview: ${result.snippet}` : '',
    ''
  ].filter(Boolean).join('\n')).join('\n');
}

// Register Kiwix tools
server.registerTool(
  "search_wiki",
  {
    title: "Search wiki",
    description: "Search for articles in the offline wiki",
    inputSchema: {
      query: z.string().describe("Search query for wiki articles"),
      library: z.string().optional().describe("Library ID to search in (optional, uses default if not specified)"),
      limit: z.number().min(1).max(50).default(10).describe("Maximum number of results to return (default: 10)")
    }
  },
  async ({ query, library, limit }) => {
    try {
      const params: Record<string, string> = {
        pattern: query,
        count: limit.toString()
      };

      if (library) {
        params.content = library;
      }

      const searchResults = await makeKiwixRequest("/search", params);

      if (!searchResults) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to search the wiki. Make sure Kiwix server is running.",
            },
          ],
        };
      }

      // Parse search results (format depends on Kiwix server response)
      let results: SearchResult[] = [];
      
      if (typeof searchResults === 'string') {
        // If HTML response, parse it (basic parsing)
        const titleMatches = searchResults.match(/<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/g) || [];
        results = titleMatches.slice(0, limit).map((match, index) => {
          const urlMatch = match.match(/href="([^"]*)"/);
          const titleMatch = match.match(/>([^<]+)</);
          return {
            title: titleMatch ? titleMatch[1] : `Result ${index + 1}`,
            url: urlMatch ? urlMatch[1] : '',
            snippet: ''
          };
        });
      } else if (Array.isArray(searchResults)) {
        results = searchResults.slice(0, limit);
      }

      const searchText = `Search results for "${query}":\n\n${formatSearchResults(results)}`;

      return {
        content: [
          {
            type: "text",
            text: searchText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching wiki: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "get_article",
  {
    title: "Get article",
    description: "Get the full content of a specific wiki article",
    inputSchema: {
      url: z.string().describe("URL or path to the wiki article"),
      library: z.string().optional().describe("Library ID (optional, uses default if not specified)")
    }
  },
  async ({ url, library }) => {
    try {
      let articleUrl = url;
      
      // If URL doesn't start with /, assume it's a relative path
      if (!url.startsWith('/') && !url.startsWith('http')) {
        articleUrl = `/${library || 'content'}/${url}`;
      }

      const articleContent = await makeKiwixRequest(articleUrl);

      if (!articleContent) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve article from ${url}. Make sure the URL is correct and Kiwix server is running.`,
            },
          ],
        };
      }

      // Extract text content if HTML
      let contentText = articleContent;
      if (typeof articleContent === 'string' && articleContent.includes('<html>')) {
        // Extract title
        const titleMatch = articleContent.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : 'Wiki Article';
        
        // Extract main content (look for common content divs)
        const contentMatch = articleContent.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is) ||
                           articleContent.match(/<main[^>]*>(.*?)<\/main>/is) ||
                           articleContent.match(/<article[^>]*>(.*?)<\/article>/is) ||
                           articleContent.match(/<body[^>]*>(.*?)<\/body>/is);
        
        const bodyContent = contentMatch ? contentMatch[1] : articleContent;
        const textContent = extractTextFromHtml(bodyContent);
        
        contentText = `# ${title}\n\n${textContent}`;
      }

      return {
        content: [
          {
            type: "text",
            text: contentText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving article: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

server.registerTool(
  "list_libraries",
  {
    title: "List libraries",
    description: "List available offline libraries in Kiwix",
  },
  async () => {
    try {
      const librariesData = await makeKiwixRequest("/catalog");

      if (!librariesData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve library list. Make sure Kiwix server is running.",
            },
          ],
        };
      }

      // Parse library information
      let librariesText = "Available offline libraries:\n\n";
      
      if (typeof librariesData === 'string') {
        // Basic HTML parsing for library list
        if (librariesData.includes('No books available')) {
          librariesText += "No libraries are currently available. Please add ZIM files to your Kiwix server.";
        } else {
          librariesText += "Libraries are available. Use the web interface to see details.";
        }
      } else if (Array.isArray(librariesData)) {
        librariesData.forEach((lib: LibraryInfo, index) => {
          librariesText += [
            `${index + 1}. **${lib.title || lib.name}**`,
            `   ID: ${lib.id}`,
            `   Language: ${lib.language || 'Unknown'}`,
            `   Articles: ${lib.articleCount || 'Unknown'}`,
            `   Size: ${lib.size || 'Unknown'}`,
            `   Description: ${lib.description || 'No description'}`,
            ''
          ].join('\n');
        });
      } else {
        librariesText += "Library information available. Check Kiwix server web interface for details.";
      }

      return {
        content: [
          {
            type: "text",
            text: librariesText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing libraries: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kiwix Wiki MCP Server running on stdio");
  console.error(`Connecting to Kiwix server at: ${KIWIX_SERVER_BASE}`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
