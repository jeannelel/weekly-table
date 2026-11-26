# The Weekly Table

A weekly meal planner: paste a recipe link from any site, pick a day, and keep every recipe in your own recipe box, with a saved copy of the ingredients and method so the recipe survives even if the website removes it. Rate each dish with your kids (loves it, it's OK, not a fan), drag meals between days, and get a shopping list for the week.

- `server.js`: the whole backend (Node 24, built-in SQLite, no dependencies).
- `public/index.html`: the web app.
- `deploy/ankra-stack.yaml`: the Ankra stack that runs it on a cluster.

Every push to `main` builds `ghcr.io/jeannelel/weekly-table`. To roll a new build onto the cluster, put its tag in `deploy/ankra-stack.yaml` and run:

```bash
ankra cluster apply -f deploy/ankra-stack.yaml --cluster playground-small-81ffe8 --wait
```
