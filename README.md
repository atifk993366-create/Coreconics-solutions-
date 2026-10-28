# Coreconics Solutions — Lab Billing & Report API

Next.js 15 (App Router) + TypeScript + Firebase (Auth + Firestore) + Cloudinary. Deploy: GitHub → Vercel.

## Kya-kya bana hai
| Area | Features |
|---|---|
| **Billing** | New bill (patient, referrer, collection centre, agent, case types, tests/packages), discount % / ₹, multi-payment (cash/UPI/card/insurance), due collection, cancel bill, bill PDF (Labsmart-style, amount in words, barcode, logo) |
| **Price list** | Har API-partner ki **apni price list** (`PUT /prices`). Bill me sirf wahi price aata hai; price set nahi to test bill nahi hota |
| **Reports** | 100+ tests/panels (CBC, LFT, KFT, Lipid, Thyroid, Iron, Serology, Urine, Culture…) seed data aapke report-format PDFs se; result entry, L/H flags (sex/age wise range), draft → final → signed, report PDF (header/logo/signatories/notes) |
| **Auto calculation** | MCV, MCH, MCHC, absolute WBC counts, BUN, eGFR (CKD-EPI 2021), LDL/VLDL/ratios, eAG, INR, TSAT, A/G, ACR… — sample reports se match verified |
| **AI Calculation Agent** | User Hinglish me likhe → AI formula banata hai → server validate + preview (before/after) → user Save → versioned rule → **agli har report usi se calculate**. Rollback/turn-off available |
| **Business** | Dashboard, Daily business, Expenses, Due report, Referral business, Case-wise report, Test counts, CSV export |
| **Cases** | Bills, Patients, Transactions, Referral doctors, Agents |
| **Lab setup** | Test database (+reference range proofread/edit), Test packages, Panels, Categories, Interpretations |
| **Auth** | Firebase email/password + Google login (automatic), email verification, **manual approval** by Coreconics admin (`/admin`), employee invites, suspend/reject |
| **Integration** | REST API (API key), iframe **embed widget** (`/embed.js`), in-app step-by-step guide with cURL / Node / Python / PHP code (`Manage → API integration guide`, public `/docs`) |

**Abhi nahi bana (phase 2):** Doctor portal, Browser-security (device allow-list), USG / Digital X-ray report templates + signatures, WhatsApp/SMS sending, Histopathology/Cytology free-text templates, Outsource lab tracking.

## Setup (30 min)
1. **GitHub**: ye folder repo me push karein.
2. **Firebase**: Console → project banayein → *Authentication* → enable **Email/Password** + **Google**. → *Firestore Database* (production mode; `firestore.rules` deploy karein — saara access sirf server API se). → Project settings → *Service accounts* → Generate key (JSON) → `FIREBASE_SERVICE_ACCOUNT`. Web app config → `NEXT_PUBLIC_FIREBASE_*`. Authentication → Settings → **Authorized domains** me Vercel domain jodein. Firestore indexes: `firebase deploy --only firestore:indexes` (file: `firestore.indexes.json`).
3. **Cloudinary**: cloud name, API key, API secret → env (logo/signature signed direct upload).
4. **Vercel**: Import repo → env vars (`.env.example` dekhein) → Deploy. Region `bom1` (Mumbai) set hai.
5. **AI agent**: `AI_API_KEY` (+ `AI_PROVIDER`, `AI_MODEL`). Anthropic default; kisi bhi OpenAI-compatible endpoint (Groq/OpenRouter/Ollama/vLLM) ke liye `AI_PROVIDER=openai` + `AI_BASE_URL`. Key na ho to basic mode chalta hai (`MCV = HCT*10/RBC` likhne par).
6. **Admin**: `PLATFORM_ADMIN_EMAILS=aapka@email` set karein → us email se `/login` → `/admin` → pending registrations approve karein.

## Registration → approval flow
`/login` (Register) → Firebase account + lab details → lab **pending** → user ko "Approval pending" screen → admin `/admin` me **Approve / Reject / Suspend** → approve hote hi login + API keys kaam karte hain. Suspend karte hi UI aur saari API keys turant band. Employee: owner email invite karta hai → us email se login karte hi seedha lab se jud jata hai.

## API quick reference (`Authorization: Bearer lsk_live_…`)
```
PUT  /api/v1/prices                      set price list           GET  /api/v1/catalog/tests
POST /api/v1/bills                       create bill (+reports)   GET  /api/v1/bills/:id/pdf
PUT  /api/v1/reports/:id/results         values → auto-calc       GET  /api/v1/reports/:id/pdf
POST /api/v1/calc/agent                  AI proposal              POST /api/v1/calc/agent/:id/confirm
POST /api/v1/embed/session               iframe token (server)    GET  /api/v1/dashboard
```
Errors: `{ "error": { "code", "message" } }`. `externalRef` bhejne par retry duplicate bill nahi banata.

## Security notes
- Calculation formulas **eval nahi hote**: custom safe parser; AI sirf formula text deta hai, server unknown parameter/functions reject karta hai.
- Har query `tenantId` se scoped; API keys SHA-256 hashed; embed token HMAC-signed (1 hr) + `frame-ancestors` allow-list; Cloudinary-only logo fetch (SSRF guard); CSV formula-injection safe; rate-limit (per-instance — production me Upstash Redis lagayein).
- ⚠ **Reference ranges** report-format PDFs se aur standard values se seed hue hain. Lab ko inhe **proofread** karna zaroori hai (Test database → test kholkar edit). Ye software clinical decision tool nahi hai.

## Local dev & tests
```
npm i && cp .env.example .env.local && npm run dev
npm test      # 38 tests: calc engine, API flow, approval workflow (no Firebase needed; in-memory repo)
```
