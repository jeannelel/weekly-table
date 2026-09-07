# The Weekly Table

A weekly meal planner: paste a recipe link from any site, pick a day, and keep every recipe in your own recipe box, with a saved copy of the ingredients and method so the recipe survives even if the website removes it.

- `server.js`: the whole backend (Node 24, built-in SQLite, no dependencies).
- `public/index.html`: the web app.
- `deploy/ankra-stack.yaml`: the Ankra stack that runs it on a cluster.

Every push to `main` builds `ghcr.io/jeannelel/weekly-table`. To roll a new build onto the cluster, put its tag in `deploy/ankra-stack.yaml` and run:

```bash
ankra cluster apply -f deploy/ankra-stack.yaml --cluster playground-small-81ffe8 --wait
```
