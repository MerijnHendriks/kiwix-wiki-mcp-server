# Kiwix Wiki MCP Server

This is a Model Context Protocol (MCP) server that provides access to offline Wikipedia and other content through Kiwix.

## Prerequisites

1. **Kiwix Server**: You need to have Kiwix server running locally with ZIM files.
   
   ### Installing Kiwix Server
   ```bash
   # On Ubuntu/Debian
   sudo apt-get install kiwix-tools
   
   # On macOS with Homebrew
   brew install kiwix-tools
   
   # Or download from https://www.kiwix.org/en/downloads/
   ```

2. **ZIM Files**: Download offline content (like Wikipedia) in ZIM format from https://library.kiwix.org/

   ### Example: Download Wikipedia
   ```bash
   # Download a small version of Wikipedia (English)
   wget https://library.kiwix.org/content/wikipedia_en_top/2024-01/wikipedia_en_top_2024-01.zim
   ```

3. **Start Kiwix Server**:
   ```bash
   kiwix-serve --port=8080 --library wikipedia_en_top_2024-01.zim
   ```
   
   The server will be accessible at http://localhost:8080

## Installation

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Running the MCP Server

```bash
npm start
```

Or run directly:
```bash
node build/main.js
```

### Available Tools

#### 1. `search_wiki`
Search for articles in the offline wiki.

**Parameters:**
- `query` (required): Search query for wiki articles
- `library` (optional): Library ID to search in
- `limit` (optional): Maximum number of results (default: 10, max: 50)

**Example:**
```json
{
  "query": "artificial intelligence",
  "limit": 5
}
```

#### 2. `get_article`
Get the full content of a specific wiki article.

**Parameters:**
- `url` (required): URL or path to the wiki article
- `library` (optional): Library ID

**Example:**
```json
{
  "url": "/A/Artificial_intelligence"
}
```

#### 3. `list_libraries`
List available offline libraries in Kiwix.

**Parameters:** None

## Configuration

By default, the server connects to Kiwix at `http://localhost:8080`. You can modify the `KIWIX_SERVER_BASE` constant in `main.ts` to change this.

## Troubleshooting

1. **"Failed to search the wiki"**: Make sure Kiwix server is running on the correct port
2. **"No libraries are currently available"**: Add ZIM files to your Kiwix server
3. **Connection errors**: Verify the Kiwix server URL and port in the configuration

## Example MCP Client Configuration

Add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "kiwix-wiki": {
      "command": "node",
      "args": ["/path/to/your/project/build/main.js"]
    }
  }
}
```

## License

ISC License