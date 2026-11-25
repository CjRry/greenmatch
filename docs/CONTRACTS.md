# GreenMatch contracts (frozen foundation)

Everything here is owned by the CEO. Import it; don't copy it. Ask on your Paperclip task for changes.

## Routes (`src/app/routes.tsx`) and links (`src/core/paths.ts`)

| Path | Page file | Owner | `paths.` builder |
|---|---|---|---|
| `/` | `features/market/pages/Landing.tsx` | market | `home()` |
| `/register?role=factory\|vendor&mode=quick` | `market/pages/Register.tsx` | market | `register(role?)`（`?mode=quick` 30 秒空白工作台精靈） |
| `/needs` | `market/pages/NeedsBoard.tsx` | market | `needs()` |
| `/needs/:id` | `market/pages/NeedDetail.tsx` | market | `need(id)` |
| `/vendors?specialty=` | `market/pages/VendorDirectory.tsx` | market | `vendors({ specialty? })` |
| `/vendors/new` | Redirect → `/register?role=vendor` | CEO (`routes.tsx`) | `register('vendor')` |
| `/vendors/:id` | `market/pages/VendorProfile.tsx` | market | `vendor(id)` |
| `/factories/new` | Redirect → `/register?role=factory` | CEO (`routes.tsx`) | `register('factory')` |
| `/factories/:id` | `market/pages/FactoryProfile.tsx` | market | `factory(id)` |
| `/me/profile` | `market/pages/EditProfile.tsx`（工廠身分顯示「我的工廠數據」單一來源編輯） | market | `profile()` |
| `/me?tab=` | `workspace/pages/Hub.tsx` | workspace | `me(tab?)` |
| `/cases/:id` | `app/CaseCenter.tsx`（單頁分頁整合 `CaseTracker` / `MatchResult` / `QuoteCompare`） | CEO / workspace | `case(id)` |
| `/cases/:id/quote/new` | `workspace/pages/QuoteSubmit.tsx` | workspace | `caseQuoteNew(id)` |
| `/new-need` | `ai/pages/NeedWizard.tsx` | ai | `newNeed()` |
| `/cases/:id/match` | `ai/pages/MatchResult.tsx` | ai | `caseMatch(id)` |
| `/cases/:id/quotes` | `ai/pages/QuoteCompare.tsx` | ai | `caseQuotes(id)` |
| `/carbon` | `carbon/pages/CarbonDashboard.tsx` | carbon | `carbon()` |
| `/carbon/entry` | `carbon/pages/CarbonEntry.tsx` | carbon | `carbonEntry()` |
| `/feedback` | `market/pages/Feedback.tsx` | market | `feedback()` |
| `/public-cases` | `app/PublicCases.tsx`（公開案例與回本回測，靜態資料，不讀 store） | CEO | `publicCases()` |
| `/bill-checkup` | `app/BillCheckup.tsx`（免登入電費單健檢、草稿暫存、補助初篩與可列印報告） | CEO | `billCheckup()` |
| `/about` | `app/TrustPages.tsx`（`AboutPage`：團隊身分、隱私承諾與媒合權重公開） | CEO | `about()` |
| `/methodology` | `app/TrustPages.tsx`（`MethodologyPage`：電價／碳排公式、回測誤差與來源清單） | CEO | `methodology()` |

Pages render inside `Shell` (header, persona switcher, mode banner, mobile bottom tabs). Start each page with
`<PageHeader title=… description=… back?=… breadcrumbs?=… actions?=… />`. Hash routing: use `useParams`, `useSearchParams`,
`useNavigate`, `Link` from `react-router`.

### Cross-page flow (who links where)

- Landing → `register(role)`, `vendors()`, `needs()`, and the persona switcher for demo sign-in.
- Register → saves the company, `signInAs(id)`, navigates to `me()` (from `?mode=quick`) or `newNeed()` / `needs()`. `?mode=quick` creates a non-demo company (`isDemo: false`) and optional initial `CarbonInventory` via `market/lib/quickRegister.ts`.
- Factory: `newNeed()` → NeedWizard saves Need + Case at stage `assess` → navigates to `caseMatch(caseId)`.
- MatchResult: supports live weight-preset/slider re-ranking (`rankVendors(..., weights, cases)`); factory confirms the 2 recommended vendors as the shortlist → case moves to `survey` → `case(id)`.
- CaseCenter (`/cases/:id?tab=progress|match|quotes`) embeds `CaseTracker`, `MatchResult`, and `QuoteCompare` under Tabs while keeping standalone `/cases/:id/match` and `/cases/:id/quotes` deep links. `CaseTracker` hides post-selection events (`contract` onward, via `visibleEventsForViewer`) as well as `contractNtd`/`startDate`/`endDate` from unselected vendors; it still links to `caseMatch(id)` while stage is `assess`, to `caseQuotes(id)` from stage `quote` on, and (vendor on the shortlist, stage `quote`) to `caseQuoteNew(id)`.
- QuoteCompare: includes interactive ROI sensitivity calculator (`computeInteractiveRoi`).
- CarbonDashboard (`/carbon`) embeds `CarbonEntry`'s shared `EntryForm` (`carbon/components/EntryForm.tsx`) via an inline 12-month editing tab and provides live Quick Carbon Calculator (`carbon/lib/quickCalc.ts`) alongside `/carbon/entry`.
- Hub rows link to `case(id)`; the factory hub's carbon card links to `carbon()`.
- Vendor cards → `vendor(id)`; need cards → `need(id)`; factory names → `factory(id)`.

## Data (`src/core/types.ts`)

Collections: `companies` (Factory | Vendor, discriminated by `role`), `needs`, `cases`, `caseEvents`,
`quotes`, `quoteComparisons` (doc id = caseId), `reviews`, `carbon` (doc id = `${factoryId}_${year}`).
Read the type comments; they define every field. Key facts:
- A Need has the factory's `rawText` and a confirmed `form` (items / monthlyElectricBillNtd / mainProblems / directions / openQuestions).
  `NeedItem.equip` is a `Specialty`: equipment only. The platform has no consulting firms: `SPECIALTIES` lists equipment only, and `'carbon_consulting'` stays in the type and `SPECIALTY_LABEL` solely so data saved earlier still renders; factories do their own inventory on `/carbon`; optional `ratedKw` holds per-unit kW for subsidy estimation. `NeedForm.monthlyElectricBillNtd` (optional NTD/month) captures parsed/edited monthly bills and can sync back to `Factory.factory` via `buildFactoryFactPatch`.
- Factory optional energy/subsidy profile fields (`Factory.factory`): `monthlyKwh`, `monthlyElectricBillNtd`, `avgElectricityPriceNtd`, `contractKw` (kW, used for ESCO 100 kW threshold), `dailyHours`, `annualDays`, `revenueOver100M` (annual subsidy cap tier), `hasFactoryReg` (工廠登記), `equipment` (`EquipmentItem` with optional `ratedKw`, `dailyHours` and per-row `source?: 'user' | 'estimate'` — a row becomes `'user'` only when the factory typed/changed it or pressed 「確認這是實際數字」; quick register writes `'estimate'` rows), and `dataSources?: Partial<Record<FactoryFactKey, FactoryFactSource>>` (tracking `'user' | 'estimate'` per fact; missing entries read as `'estimate'`). Vendor optional fields (`Vendor.vendor`): `assistsSubsidy`, `servedIndustries` (`INDUSTRIES` labels this vendor has collaborated with), and `portfolio[].industry`.
- A Case follows one Need through `StageKey` stages. `recommendations` (2), `shortlist` (invited vendors),
  `selectedVendorId` (from stage `contract`), `contractNtd` / `startDate` / `endDate` (visible only to the factory and selected vendor — never written into `caseEvents`), `usage` (monthly kWh before/after for stage `compare`).
  `status` is `completed` once stage `compare` is done.
- `caseEvents` is the append-only timeline (`kind`, `actor`, `text`, `at`); contract amounts and schedules must not be embedded in `text`.
- Needs board shows needs with `status === 'open'`. 「我有興趣」 adds the vendor id to `interestedVendorIds`.

### Store (`src/core/store/StoreProvider.tsx`)

```ts
const docs = useCollection('cases')          // readonly Case[] | undefined (undefined = loading)
const c = useDoc('cases', id)                // Case | null | undefined
const store = useStore()                     // writes: set (full replace), update (deep merge), remove, newId
const { mode, readOnly } = useStoreInfo()    // mode: 'local' | 'db' | 'fakedb'
await store.update('cases', id, { stage: 'survey', stageStartedAt: nowIso(), updatedAt: nowIso() })
await store.set('caseEvents', { id: store.newId('ev'), caseId: id, stage: 'assess', kind: 'stage_done', actor: 'factory', actorId, text: '…', at: nowIso() })
```
Arrays are replaced by `update`, objects merge. Sort and filter in the component; order is not guaranteed.

### Session (`src/core/session.tsx`)

`const { company, companyId, role, viewerId, signInAs, signOut } = useSession()` — the demo persona.
`company` is undefined while loading and null when signed out. Pages that need a role show an `EmptyState`
with a button that opens sign-in (`paths.register()`, or tell them to use 「示範登入」 in the header).
New companies set `ownerId: viewerId` and `isDemo: false`.

### Constants (`src/core/constants/*`)

- `stages.ts`: `STAGES` (n, label, what, owners, ownerLabel, eta, factoryPrep, vendorTodo), `STAGE_BY_KEY`,
  `stageIndex`, `nextStage`, `isOwner(stage, 'factory'|'vendor'|'platform')`, `ETA_NOTE`.
- `equipment.ts`: `EQUIPS`, `EQUIP_INFO[e].label/keywords/directions`, `SPECIALTIES`, `SPECIALTY_LABEL`,
  `RELATED_EQUIP`, `SCALE_LABEL`, `SCALE_SHORT`, `scaleFromEmployees`, `PRESSURE_LABEL`, `INDUSTRIES`.
- `geo.ts`: `CITIES`, `City`, `CITY_INFO[city].region`, `REGIONS`, `cityDistanceKm`, `isCity`.
- `carbon.ts`: `ELECTRICITY_FACTOR` (0.474), `FUELS`, `FUEL_KEYS`, `INV_STEPS`, notes for factors and carbon fee.

### Domain logic (`src/core/domain/*`)

- `factoryFacts.ts`: single source of truth for factory energy/operating facts and platform defaults (`DEFAULT_ELECTRICITY_PRICE_NTD = 4.2`, `DEFAULT_DAILY_HOURS = 16`, `DEFAULT_ANNUAL_DAYS = 300`, `DEFAULT_ANNUAL_OPERATING_HOURS`, `DEFAULT_FALLBACK_MONTHLY_KWH`, `CARBON_FEE_THRESHOLD_TONS`, `CARBON_FEE_PER_TON_NTD`, `DEFAULT_EQUIPMENT_SHARES`, `ELECTRICITY_FACTOR`). Provides `resolveFactoryFacts(factory, latestCarbonInventory?)` (returning values, `'user' | 'estimate'` source, and Traditional Chinese notes), `buildFactoryFactPatch(factory, updates, now)`, `factSourceKind`, `overallFactSource`, and `formatEquipmentSummary`.
- `matching.ts`: `rankVendors(need, factory, companies, reviews, weights?, cases?)` → top 2 `Recommendation`s with
  5 factor scores (including same-industry collaboration inside `track`) and reason text. `DEFAULT_WEIGHTS`, `FACTOR_KEYS`, `FACTOR_LABEL`, `requiredSpecialties`, `itemLabel`, `vendorIndustryExperience`, `sameIndustrySummary`.
- `carbon.ts`: `summarizeInventory(inv)` (scope1T, scope2T, totalT, months[], filledMonths — typed months only, estimatedMonths, stepsDone),
  `monthsUpToToday(year, taipeiToday)`, `applyEstimatedMonthlyKwh(months, kwh, fillable)` (fills blank/estimated months only, tags `kwhSource: 'estimate'`),
  `scope1Kg`, `scope2Kg`, `latestInventory`, `inventoryId`, `emptyInventory`.
- `vendorStats.ts`: `vendorStats(vendorId, reviews)` → `{ avg, count, bayes }`.
- `roi.ts`: the one payback calculation — `computeInteractiveRoi(fields, subsidyRange, input)`, `totalNtd`, `DEFAULT_ROI_RATE_NTD` / `DEFAULT_ROI_DAILY_HOURS` / `DEFAULT_ROI_DAYS_PER_YEAR`, `BASE_ANNUAL_OPERATING_HOURS`. `features/ai/lib/quoteParser.ts` re-exports them unchanged.
- `publicCaseBacktest.ts`: `backtestPublicCase(c, rate?)`, `summarizeBacktest(cases, rate?)` → `{ rows, comparedCount, maeYears, biasYears, maxAbsErrorYears, mapePct, impliedPriceRange, platformRateNtd }`. Runs `computeInteractiveRoi` at platform defaults and compares with the source's pre-subsidy payback.

### Public cases (`src/data/publicCases.ts`, PROP-0006)

`PUBLIC_CASES: readonly PublicCase[]` (type in `core/types.ts`) and `PUBLIC_CASES_CHECKED_DATE`. Real cases from 能源署節能標竿網,
each with `source.url` / `caseNo` / `section` / `checkedDate`. Static: never written to the store, never `isDemo`, never shown
with `DemoBadge`. `null` = the source does not state it → show `NOT_DISCLOSED`（「來源未揭露」）; never estimate. These companies
did not use the platform: show `PUBLIC_CASE_DISCLAIMER` next to any list, and never call them 用戶 or 成功案例.
Add a case only after opening its source and checking every number.

### Subsidies (`src/core/subsidies/index.ts`)

- `SUBSIDIES`, `SUBSIDY_BY_ID`, `SUBSIDY_CHECKED_DATE`, `SUBSIDY_DISCLAIMER`, `COMMERCIAL_EXCLUSION_NOTE`.
- `hpToKw(hp)` converts horsepower ratings to kW.
- `resolvePowerRate(equip, kw, subtype?)`: 動力與公用設備補助 rate band (元／kW) from the 115/01/29 作業要點 table, by machine type (`PowerSubtype`, labels in `POWER_SUBTYPE_LABEL`, per-equipment lists in `POWER_SUBTYPES`). Without a subtype it spans every type subsidised at that power; returns null when that type/power is not subsidised (variable-speed compressors start at 7.5 kW, piston ones stop at 75 kW). `NeedItem.subtype` is optional and only used for `air_compressor` / `pump_fan`.
- `taipeiToday(now = nowIso())` → today's date in Taiwan (UTC+8) as `YYYY-MM-DD`. Subsidy deadlines are Taiwan dates.
- `CarbonInventory` includes optional `electricityShareSource?: FactSourceKind` (defaults to `'estimate'` on read; becomes `'user'` only after the factory moves a share slider/field and saves — an untouched split keeps its source). `CarbonMonth.kwhSource?: FactSourceKind` (missing = typed by the factory; `'estimate'` = written by 「以估算填入」, never counted as a filled month).
- `matchSubsidies(input, today = taipeiToday())` → `SubsidyMatchSummary` (`items`, cash-grant `totalRange` excluding `tax-credit`, `usesRelayedRates`, separate `taxCreditRange`, `totalNote`, `nearestDeadline`, `checkedDate`, `disclaimer`, `factSource`, `provenance`). Reads factory facts via `resolveFactoryFacts`; when `contractKw` is `'estimate'`, ESCO (`espc`) returns `status: 'needs_info'`; when `usesRelayedRates` is true, `provenance` includes `subsidyRate` (`'estimate'`).
- `stageSubsidyReminders(stage, summary)` → stage-specific subsidy reminders.

### Format (`src/core/format.ts`)

`formatNtd`, `formatKwh` (「度」), `formatTons`, `formatPct`, `formatNumber`, `formatDate`, `formatDateTime`,
`relativeTime`, `monthLabel`, `nowIso`.

### AI (`src/core/ai/askJson.ts`)

```ts
const res = await askJson(prompt, (v) => (isValid(v) ? (v as MyShape) : null), { signal, tier: 'quick' })
if (res.ok) use(res.value)   // source 'claude'
else if (res.reason !== 'cancelled') { fallback(); toast({ title: res.message, tone: 'info' }) }
```
`aiAvailable()` tells whether Claude can be asked here (false when running locally: rule-based only).
It never prompts; only `askJson` does, so call it from a click.

## UI kit (`src/ui`, import from `'../../../ui'` or the right relative path)

`Button` (variant primary|secondary|ghost|danger|navy, size sm|md|lg, icon, busy), `ButtonLink` (router link),
`Card`, `SectionTitle`, `Badge` (tone neutral|brand|navy|warn|danger|outline), `DemoBadge`, `Tabs` (items with
counts, optional `wrap`), `Field` (render-prop gives id/aria), `TextInput`, `TextArea`, `Select`, `ChipGroup` (multi or single),
`Dialog`, `ConfirmDialog`, `useToast()` (`toast({ title, body?, tone? })`), `EmptyState`, `Skeleton`,
`SkeletonList`, `ScrollX`, `PageHeader`, `CompanyAvatar`, `StageBadge`, `StageProgress` (compact 8-step bar),
`SpecialtyChips`, `RatingStars`, `ScoreBar`, `Stat`, `SourceTag`, `FactSourceBadge` (`variant?: 'field' | 'derived'` — `'你填的'`/`'平台估算'` vs `'依你填的資料'`/`'含平台估算'`), `FactProvenance` (with `ProvenanceItem`, `'均依你填的資料計算'` when no estimates, and inline 「改成我的數字」 writeback), `SubsidyCard`, `SubsidyDialog`,
`SubsidyStageBanner`, `VendorSubsidyBadge`, `FeedbackNudge`, `cx`. Public cases: `PublicCaseBadge`（「公開案例」, navy）,
`PublicCaseCard`, `PublicCaseStats` (case count + backtest MAE/bias/MAPE), `PublicCaseBacktestTable` (in `ScrollX`, own empty state),
`SourceLink`, `NOT_DISCLOSED`, `PUBLIC_CASE_DISCLAIMER`, `SimilarCasePayback` (`equips`, `electricityRate`, `rateSource`, `cases`,
`allCasesTo`: same-equipment public cases re-run at the factory's price — payback before any quote; used by MatchResult and the
empty QuoteCompare).

Breadcrumbs: `PageHeader` takes `breadcrumbs?: BreadcrumbItem[]` (`type BreadcrumbItem = { label: string; to?: string }`,
exported from `src/ui`). List the trail from the top level down; give every item except the current page a `to`
built with `paths.*`. It renders as `<nav aria-label="麵包屑">` above the title and wraps at 375px. When
`breadcrumbs` is given, do not also pass `back`.

## Tests (`src/test`)

```ts
import { renderPage } from '../../../test/renderPage'
renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c01', companyId: 'f01' })
await screen.findByText('方案與報價')
renderPage(<NeedsBoard />, { path: '/needs', data: {} })   // empty store
```
Navigation away from the page renders `data-testid="location"` with the new path. `renderApp(routes, …)`
mounts the whole app (QA flows). Demo ids are listed in `src/test/fixtures.ts`.
