# Graph Report - erlekide  (2026-06-05)

## Corpus Check
- 11 files · ~117,967 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 120 nodes · 200 edges · 19 communities (15 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f9eec6c7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `toast()` - 15 edges
2. `enterApp()` - 11 edges
3. `openM()` - 11 edges
4. `renderAll()` - 9 edges
5. `🐝 Erlekide — Erlategiaren Kudeaketa` - 9 edges
6. `🚀 Despliege pausoak / Pasos de despliegue` - 9 edges
7. `closeM()` - 8 edges
8. `renderDP()` - 7 edges
9. `saveSettings()` - 6 edges
10. `selHive()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `boot()` --calls--> `enterApp()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 11 → community 4_
- `boot()` --calls--> `toast()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 11 → community 1_
- `enterApp()` --calls--> `loadExpenses()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 4 → community 7_
- `enterApp()` --calls--> `loadMaterials()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 4 → community 9_
- `enterApp()` --calls--> `loadMembers()`  [EXTRACTED]
  public/app.js → public/app.js  _Bridges community 4 → community 6_

## Import Cycles
- None detected.

## Communities (19 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (17): 1️⃣ Supabase proiektua sortu, 2️⃣ Datu-basea sortu, 3️⃣ Email berrespena desaktibatu ⚠️ (garrantzitsua!), 4️⃣ Supabase gakoak kopiatu, 5️⃣ GitHub-era igo (aukerazkoa baina gomendatua), 6️⃣ Vercel-en desplegatu, 7️⃣ Ingurune-aldagaiak konfiguratu, 8️⃣ Prest! 🎉 (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.23
Nodes (16): closeM(), delHive(), loadInsps(), od(), readPosSelects(), renderAll(), renderDP(), renderGrid() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (7): expenses, hives, insps, MAT_ICONS, MAT_LABELS, materials, members

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (8): envPath, fs, http, MIME, path, PUBLIC, server, url

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (8): buildGrid(), doLogin(), doReg(), enterApp(), loadHives(), loadSettings(), saveSettings(), updateHint()

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (5): description, engines, node, name, version

### Community 6 - "Community 6"
Cohesion: 0.50
Nodes (5): addMember(), deleteMember(), loadMembers(), openMembers(), renderMembersList()

### Community 7 - "Community 7"
Cohesion: 0.50
Nodes (5): calcDebts(), deleteExp(), loadExpenses(), renderExpenses(), saveExp()

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (5): cc(), fillPosSelects(), openAddModal(), openEdit(), resetDelBtn()

### Community 9 - "Community 9"
Cohesion: 0.50
Nodes (5): deleteMat(), loadMaterials(), renderMaterials(), saveMat(), setMainView()

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (5): openAddMat(), openCfg(), openEditMat(), openInsp(), openM()

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (4): boot(), doLogout(), initSB(), showLogin()

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (4): esc(), openAddExp(), openEditInsp(), runAI()

## Knowledge Gaps
- **39 isolated node(s):** `PreToolUse`, `allow`, `name`, `version`, `description` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `toast()` connect `Community 1` to `Community 2`, `Community 4`, `Community 6`, `Community 7`, `Community 9`, `Community 11`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `allow`, `name` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._