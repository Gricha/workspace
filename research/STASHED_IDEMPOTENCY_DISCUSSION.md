# Idempotency Discussion (Stashed)

## Problem
`sendMessage()` calls `POST /session/:id/prompt_async` which is NOT idempotent. Retrying on failure could create duplicate messages.

## Options Considered

1. **Don't retry** - Simple, no duplicates, bad UX for transient failures

2. **Retry only on connection errors** (recommended for quick fix)
   - Connection refused (curl exit 7) = safe to retry (never received)
   - HTTP errors / timeouts = unsafe (may have been queued)
   - Requires careful error classification

3. **Client-side deduplication**
   - Generate unique `messageId` per request
   - Track sent messageIds, check SSE for responses
   - If no SSE activity, safe to retry

4. **Request OpenCode add idempotency key support**
   - Standard pattern: `Idempotency-Key: <uuid>` header
   - Server deduplicates
   - Best solution, requires upstream change

## Decision
TBD - discuss with user
