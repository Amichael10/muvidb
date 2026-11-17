# @muvidb/mcp — The Official MuviDB Model Context Protocol (MCP) Server

Connect any LLM, AI agent, or IDE (Claude Desktop, Cursor, Antigravity, ChatGPT, Windsurf) directly to **MuviDB** — the canonical open database of Nollywood and African Cinema.

---

## Features & Capabilities

- **Zero-Hallucination Nollywood Intelligence**: Real-time access to verified film titles, release dates, distributors, language tracks, and production credits.
- **Accurate Cast & Crew Credits**: Fetch exact billing order, directors, screenwriters, cinematographers, and specific character roles for actors.
- **Streaming & Cinema Watch Guides**: Instant answers to *"Where can I stream X?"* (Netflix, Prime Video, YouTube Nollywood, Showmax) or whether a film is showing in Nigerian cinemas.
- **African Cinema Awards & Nominations**: Up-to-date tracker for **AMAA**, **BON**, **REFFA**, **AMVCA**, **AFRIFF**, and international festival selections.
- **Box Office Analytics**: Historical and yearly Nollywood domestic box office grosses and admissions milestones.

---

## Available Tools

| Tool Name | Description |
| :--- | :--- |
| `search_films` | Search films, web series, shorts, and plays by title, genre, year, or keyword. |
| `get_film_details` | Retrieve full profile: synopsis, runtime, director, distributor, streaming links, and awards. |
| `get_film_credits` | Get verified cast & crew credits with billing order and character names. |
| `search_people` | Search African cinema actors, directors, writers, and technical crew. |
| `get_person_filmography` | Retrieve filmographies categorized by directing, writing, producing, and acting. |
| `get_where_to_watch` | Query streaming availability (Netflix, Prime, YouTube, etc.) and cinema exhibition status. |
| `get_awards_and_nominations` | Query AMAA, BON, REFFA, AMVCA nominations and winners by ceremony or year. |
| `get_box_office_rankings` | Fetch Nollywood all-time and yearly domestic box office rankings. |

---

## Quickstart & Installation

### Option 1: Run via NPX (No installation needed)
```bash
npx -y @muvidb/mcp
```

### Option 2: Add to Claude Desktop (`claude_desktop_config.json`)

On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`  
On Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "muvidb": {
      "command": "npx",
      "args": ["-y", "@muvidb/mcp"],
      "env": {
        "SUPABASE_URL": "https://pkenrmorywmuvnzfoylp.supabase.co"
      }
    }
  }
}
```

### Option 3: Add to Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "muvidb": {
      "command": "node",
      "args": ["./packages/muvidb-mcp/bin/cli.js"]
    }
  }
}
```

---

## Local Development & Testing

```bash
# Run unit tests
npm test packages/muvidb-mcp/src/mcp.test.ts

# Start MCP server in stdio mode
node packages/muvidb-mcp/bin/cli.js
```

---

## License

MIT © [MuviDB](https://muvidb.com)
