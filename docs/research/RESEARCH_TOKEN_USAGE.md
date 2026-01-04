# Research: Token Usage Tracking for Coding Agents

## Objective

Research and document approaches for tracking API token usage across workspaces, enabling users to monitor costs and usage patterns for Claude Code, Codex, OpenCode, and other AI coding assistants.

---

## Research Questions

### 1. What data should we track?

| Data Point | Purpose | Priority |
|------------|---------|----------|
| Request count | Usage volume | High |
| Input tokens | Cost calculation | High |
| Output tokens | Cost calculation | High |
| Model used | Cost accuracy | High |
| Timestamp | Time-series analysis | High |
| Workspace name | Per-workspace breakdown | High |
| Response latency | Performance monitoring | Medium |
| Error count | Reliability tracking | Medium |
| Tool/agent name | Multi-tool breakdown | Medium |
| Estimated cost | User-friendly display | Medium |

### 2. How do different tools expose usage data?

#### Claude Code
- **API**: Anthropic API returns usage in response headers/body
- **SDK**: `anthropic` Python/Node SDK includes usage in response
- **Format**: `input_tokens`, `output_tokens` in response
- **Logging**: Claude Code may log to stderr (research needed)

#### OpenAI (OpenCode, Codex)
- **API**: OpenAI API returns usage in response body
- **SDK**: `openai` Python/Node SDK includes usage in response
- **Format**: `usage: { prompt_tokens, completion_tokens, total_tokens }`
- **Logging**: SDK can be configured to log

#### GitHub Copilot
- **API**: Internal, not directly accessible
- **Logging**: Limited visibility
- **Alternative**: May need extension-level tracking

### 3. Interception approaches

#### A. Environment Variable Proxy
```
How it works:
1. Set HTTP_PROXY/HTTPS_PROXY in workspace
2. Route all traffic through local proxy
3. Proxy logs API calls to tracking service

Pros:
- Works for all HTTP-based tools
- No tool-specific integration
- Comprehensive coverage

Cons:
- SSL certificate management (MITM)
- Performance overhead
- Some tools bypass proxy settings
- Complex setup
```

#### B. SDK Wrapper/Instrumentation
```
How it works:
1. Install instrumented SDK versions
2. SDK reports usage to local service
3. Aggregate across workspaces

Pros:
- Clean, supported approach
- No MITM required
- Accurate data

Cons:
- Tool-specific implementation
- May break with SDK updates
- Requires modifying workspace environment
```

#### C. Log Parsing
```
How it works:
1. Configure tools to log verbosely
2. Parse log files for usage data
3. Aggregate and store

Pros:
- Non-invasive
- No MITM required
- Works with existing logs

Cons:
- Log format may change
- May miss data
- Parsing complexity
```

#### D. API Gateway/Wrapper
```
How it works:
1. Run local API gateway in workspace
2. Tools configured to use gateway as endpoint
3. Gateway forwards to real API, logs usage

Pros:
- Clean interception
- No MITM certificates
- Works for all tools

Cons:
- Must configure each tool
- May break tool-specific features
- Latency overhead
```

#### E. External Service Integration
```
How it works:
1. Use service like LangSmith, Helicone, or similar
2. Configure API keys through their proxy
3. View usage in their dashboard

Pros:
- No implementation needed
- Rich analytics
- Alerting and dashboards

Cons:
- External dependency
- Privacy concerns
- May have costs
- Not self-hosted
```

---

## Recommended Approach

### MVP: Log-based + API Response Parsing

For the simplest initial implementation:

1. **Configure tools to log verbose output**
   - Claude Code: Check for logging options
   - OpenCode: Enable SDK logging
   - Capture stderr in workspace

2. **Parse API responses in real-time**
   - Instrument SDK calls in workspace init script
   - Write usage data to local file

3. **Aggregate on agent**
   - Periodically collect usage files from workspaces
   - Store in SQLite on agent

4. **Display in UI**
   - Show total usage per agent
   - Per-workspace breakdown
   - Time-series graph

### Implementation Sketch

```typescript
// In workspace post-start script or environment

// Wrap anthropic SDK
const originalCreate = anthropic.messages.create
anthropic.messages.create = async (...args) => {
  const response = await originalCreate(...args)
  logUsage({
    agent: 'claude',
    workspace: process.env.WORKSPACE_NAME,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    model: response.model,
    timestamp: new Date().toISOString()
  })
  return response
}

// Log to file that agent collects
function logUsage(data: UsageData) {
  fs.appendFileSync('/workspace/.usage.jsonl', JSON.stringify(data) + '\n')
}
```

```typescript
// On agent: collect usage data
async function collectUsageData(workspace: string) {
  const usageFile = await docker.exec(workspace, 'cat /workspace/.usage.jsonl')
  const lines = usageFile.trim().split('\n')
  for (const line of lines) {
    const data = JSON.parse(line)
    await db.insert('usage', data)
  }
  // Clear collected data
  await docker.exec(workspace, 'echo > /workspace/.usage.jsonl')
}
```

---

## Data Storage

### SQLite Schema
```sql
CREATE TABLE usage (
  id INTEGER PRIMARY KEY,
  agent TEXT NOT NULL,         -- 'claude', 'openai', 'codex'
  workspace TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  model TEXT,
  cost_estimate REAL,
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_workspace ON usage(workspace);
CREATE INDEX idx_usage_agent ON usage(agent);
CREATE INDEX idx_usage_timestamp ON usage(timestamp);
```

### Aggregation Queries
```sql
-- Total usage per agent
SELECT agent, SUM(input_tokens) as input, SUM(output_tokens) as output
FROM usage
GROUP BY agent;

-- Daily usage
SELECT date(timestamp) as day, SUM(input_tokens + output_tokens) as tokens
FROM usage
GROUP BY date(timestamp)
ORDER BY day DESC;

-- Per-workspace breakdown
SELECT workspace, agent, SUM(input_tokens) as input, SUM(output_tokens) as output
FROM usage
GROUP BY workspace, agent;
```

---

## Cost Calculation

### Current Pricing (as of research date)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude 3.5 Sonnet | $3.00 | $15.00 |
| Claude 3 Opus | $15.00 | $75.00 |
| GPT-4 Turbo | $10.00 | $30.00 |
| GPT-4o | $5.00 | $15.00 |
| GPT-3.5 Turbo | $0.50 | $1.50 |

### Cost Estimation
```typescript
const PRICING = {
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4o': { input: 5.0, output: 15.0 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model]
  if (!pricing) return 0
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}
```

---

## UI Design

### Usage Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│ Token Usage                                    [This Month]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Total Tokens: 1,234,567                                   │
│  Estimated Cost: $12.34                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Usage Over Time                                      │   │
│  │     ^                                                │   │
│  │     │    ___/\                                       │   │
│  │     │___/      \__/\                                │   │
│  │     └───────────────────────────────────────>       │   │
│  │     Jan 1      Jan 15      Jan 30                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  By Agent:                                                  │
│  ├── Claude Code    892,345 tokens ($8.92)                 │
│  ├── OpenCode       234,567 tokens ($2.34)                 │
│  └── Codex          107,655 tokens ($1.08)                 │
│                                                             │
│  By Workspace:                                              │
│  ├── alpha          567,890 tokens                         │
│  ├── beta           432,100 tokens                         │
│  └── gamma          234,577 tokens                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Privacy Considerations

### What we DON'T store:
- Actual prompts or completions
- File contents
- Code being analyzed
- Any PII

### What we DO store:
- Token counts (aggregate numbers only)
- Model names
- Timestamps
- Workspace identifiers

### Data Retention
- Default: 90 days
- Configurable by user
- Can be disabled entirely

---

## Alternative: Third-Party Services

### Helicone
- Drop-in proxy for OpenAI/Anthropic
- Change base URL to use their proxy
- Rich analytics dashboard
- Free tier available

### LangSmith
- From LangChain
- More focused on tracing/debugging
- Can track token usage
- Requires code integration

### Custom Proxy
- Self-hosted option
- Full control
- More work to implement

---

## Implementation Tasks

### Phase 1: Basic Tracking (MVP)
- [ ] Create SQLite schema for usage data
- [ ] Implement collection script in workspace
- [ ] Agent endpoint to receive usage data
- [ ] Basic UI showing total usage

### Phase 2: Per-Agent Breakdown
- [ ] Identify model from each agent
- [ ] Store agent type in usage data
- [ ] UI breakdown by agent

### Phase 3: Cost Estimation
- [ ] Add pricing table
- [ ] Calculate estimated costs
- [ ] Display in UI

### Phase 4: Time-Series Visualization
- [ ] Daily/weekly/monthly aggregation
- [ ] Chart component in UI
- [ ] Date range selector

### Phase 5: Alerts (Future)
- [ ] Cost threshold alerts
- [ ] Usage anomaly detection
- [ ] Email/notification integration

---

## Decision Points

1. **Tracking approach**: Log-based vs proxy vs SDK instrumentation?
2. **Storage location**: SQLite on agent vs external service?
3. **Collection frequency**: Real-time vs periodic batch?
4. **Opt-in vs opt-out**: Should tracking be enabled by default?
5. **Third-party integration**: Build custom or use Helicone/similar?

---

## Recommendation

**Start with log-based approach:**
1. Simple to implement
2. No MITM complexity
3. Works for tools with verbose logging
4. Can be enhanced later

**Store in SQLite on agent:**
1. Self-contained
2. No external dependencies
3. Easy to query
4. Can export if needed

**Build simple UI first:**
1. Total usage display
2. Per-workspace breakdown
3. Add charts later

**Make it optional:**
1. Disabled by default
2. User enables in settings
3. Clear data retention policy

---

## References

- [Anthropic API Usage](https://docs.anthropic.com/en/api/getting-started)
- [OpenAI Usage Tracking](https://platform.openai.com/usage)
- [Helicone](https://helicone.ai/)
- [LangSmith](https://smith.langchain.com/)
- [LiteLLM Proxy](https://docs.litellm.ai/docs/proxy/usage_tracking)

---

## Next Steps

1. Review with project owner
2. Decide on approach (recommend: log-based + SQLite)
3. Create implementation tasks
4. Update DESIGN.md with reference to this document
