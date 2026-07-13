# opencode-desktop-context

## Deployment

This project has a Dagger module (`dagger.json` in `./`).
From the repository root, run:

```bash
# list available functions
dagger call --help -m ./
```

Common deployment functions:

```bash
# Publish the package to npm using the NPM_TOKEN environment variable.
export NPM_TOKEN="your-npm-token"
dagger call -m ./ publish
```

You may need to export required tokens before calling deploy functions (e.g., `GH_TOKEN`, `CLOUDFLARE_API_TOKEN`, `REGISTRY_TOKEN`, `NPM_TOKEN`).
