# 🐝 Erlekide — Erlategiaren Kudeaketa

**Vercel + Supabase-n oinarritutako erlategiaren kudeaketa sistema.**  
Sistema de gestión de apiarios sobre Vercel + Supabase.

---

## 🏗️ Arkitektura

```
Vercel (hosting + serverless)
  ├── public/index.html   ← Frontend osoa (HTML + CSS + JS)
  ├── api/config.js       ← Supabase gakoak ematen ditu
  └── api/analyze.js      ← Anthropic AI proxy (autentifikatua)

Supabase (datu-basea + autentifikazioa)
  ├── Auth               ← Erabiltzaileen saioak (JWT)
  ├── hives              ← Erlauntzak eta posizioak
  └── inspections        ← Ikuskaritza historia
```

---

## 🚀 Despliege pausoak / Pasos de despliegue

### 1️⃣ Supabase proiektua sortu

1. Joan **https://supabase.com** → "New project"
2. Proiektuari izena eman, pasahitza jarri eta zona aukeratu

### 2️⃣ Datu-basea sortu

1. Supabase > **SQL Editor** > "New query"
2. `supabase/schema.sql` fitxategiaren edukia itsatsi eta **Run** sakatu

### 3️⃣ Email berrespena desaktibatu ⚠️ (garrantzitsua!)

> Aplikazioak `erabiltzailea@erlategia.app` formatuko email faltsua erabiltzen du  
> benetako email bat eskatu gabe. Beraz, berrespena desaktibatu behar da.

1. Supabase > **Authentication** > **Settings**
2. **"Enable email confirmations"** → **desaktibatu** (toggle off)
3. **Save** sakatu

### 4️⃣ Supabase gakoak kopiatu

Supabase > **Project Settings** > **API**:
- `Project URL` → `SUPABASE_URL`
- `anon / public` gakoa → `SUPABASE_ANON_KEY`

### 5️⃣ GitHub-era igo (aukerazkoa baina gomendatua)

```bash
git init
git add .
git commit -m "Erlekide hasierako bertsioa"
git remote add origin https://github.com/zure-erabiltzailea/erlekide.git
git push -u origin main
```

### 6️⃣ Vercel-en desplegatu

**A) GitHub bidez (gomendatua):**
1. Joan **https://vercel.com** → "Add New Project"
2. GitHub repositorioa inportatu
3. Framework: **Other** (ez aldatu ezer)
4. Deploy sakatu — lehen despliegea egin aurretik ingurune-aldagaiak gehitu (hurrengo pausoa)

**B) Vercel CLI bidez:**
```bash
npm i -g vercel
vercel login
vercel --prod
```

### 7️⃣ Ingurune-aldagaiak konfiguratu

Vercel > proiektua > **Settings** > **Environment Variables**:

| Aldagaia / Variable | Balioa / Valor |
|---------------------|----------------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGc...` (anon key) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (aukerazkoa) |

Aldagaiak gehitu ondoren: **Redeploy** sakatu.

### 8️⃣ Prest! 🎉

`https://zure-proiektua.vercel.app` helbidean eskuragarri.

---

## 🔑 Lehen erabiltzailea sortu

1. Aplikazioa ireki → **Erregistratu** fitxa
2. Erabiltzaile izena eta pasahitza sartu
3. Gainerako taldekideek berdin egin dezakete

---

## 🌍 Domeinua pertsonalizatu (aukerazkoa)

Vercel > **Settings** > **Domains** → zure domeinua gehitu.

---

## 🤖 IA analisia (aukerazkoa)

`ANTHROPIC_API_KEY` gehituz gero, ikuskaritza bakoitzean **«IArekin aztertu»** botoia agertuko da. Gakoa Anthropic kontsolan lortzen da: https://console.anthropic.com

---

## 📁 Egitura / Estructura

```
erlekide/
├── vercel.json          ← Vercel konfigurazioa
├── package.json
├── .env.example         ← Aldagaien eredua
├── api/
│   ├── config.js        ← Supabase URL/key frontend-era
│   └── analyze.js       ← Anthropic proxy (JWT autentifikatua)
├── public/
│   └── index.html       ← Frontend osoa (euskaraz, responsive)
└── supabase/
    └── schema.sql       ← DB eskema + RLS politikak
```

---

## 🔒 Segurtasuna

- Pasahitzak Supabase-k kudeatzen ditu (bcrypt)
- Saioak JWT bidez (Supabase Auth)
- RLS (Row Level Security) aktibo: erabiltzaile autentifikatuek bakarrik ikus ditzakete datuak
- Anthropic API gakoa zerbitzarian bakarrik (bezeroari inoiz ez bidaltzen)

---

## 🔧 Migrazioa: inspekzioak editatzeko politika / Migración: política para editar inspecciones

> Lehendik sortutako datu-baseetan `insp_update` RLS politika falta da eta
> **inspekzioak editatzea isilik huts egiten du**. Konpontzeko, exekutatu hau
> Supabase > SQL Editor-en behin / Ejecutar una vez en el SQL Editor de Supabase:

```sql
drop policy if exists "insp_update" on public.inspections;
create policy "insp_update" on public.inspections for update
  using (auth.role() = 'authenticated');
```

---

## 🐛 Arazoak / Problemas comunes

**"SUPABASE_URL ingurune-aldagaia falta da"**  
→ Vercel-en Environment Variables behar bezala konfiguratu eta Redeploy egin.

**"Erregistratu ondoren saioa ez da hasten"**  
→ Supabase-n "Enable email confirmations" desaktibatu (3. pausoa).

**"AI botoia ez dago"**  
→ `ANTHROPIC_API_KEY` Vercel-en gehitu eta Redeploy egin.

---

MIT Lizentzia — Erabili, aldatu eta banatu askatasunez.
