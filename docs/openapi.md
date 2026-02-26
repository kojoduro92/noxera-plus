# OpenAPI Contract + Generated Client

## Generate the contract and client

Run from repo root:

```bash
pnpm openapi:generate
```

This command does two things:

1. Exports the NestJS OpenAPI contract to:
   - `apps/api/openapi/openapi.json`
2. Generates TypeScript API types from that contract into:
   - `packages/api-client/src/generated/openapi.ts`

## Runtime API docs

When the API is running, Swagger docs are available at:

- `http://localhost:3001/docs`
- Raw OpenAPI JSON: `http://localhost:3001/docs/openapi.json`

## CI enforcement

CI regenerates the contract/client and checks both files are committed:

- `.github/workflows/ci.yml`
