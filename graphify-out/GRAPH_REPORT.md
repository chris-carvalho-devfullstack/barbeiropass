# Graph Report - C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass  (2026-06-04)

## Corpus Check
- 93 files · ~47,043 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 262 nodes · 276 edges · 64 communities detected
- Extraction: 72% EXTRACTED · 28% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]

## God Nodes (most connected - your core abstractions)
1. `Select()` - 25 edges
2. `createClient()` - 25 edges
3. `GET()` - 10 edges
4. `getBarbershopId()` - 9 edges
5. `POST()` - 9 edges
6. `refreshOnboardingScore()` - 8 edges
7. `DELETE()` - 7 edges
8. `syncMyOnboardingScore()` - 6 edges
9. `onSubmit()` - 5 edges
10. `fetchStaff()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `handleCreateStation()` --calls--> `Select()`  [INFERRED]
  C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\app\(dashboard)\equipe\cadeiras\page.tsx → C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\components\ui\select.tsx
- `handleDeleteStation()` --calls--> `DELETE()`  [INFERRED]
  C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\app\(dashboard)\equipe\cadeiras\page.tsx → C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\app\api\staff\route.ts
- `submitReviewAction()` --calls--> `createClient()`  [INFERRED]
  C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\app\(dashboard)\fila\actions.ts → C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\utils\supabase\server.ts
- `loadBarbershop()` --calls--> `Select()`  [INFERRED]
  C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\app\(dashboard)\fila\[slug]\page.tsx → C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\components\ui\select.tsx
- `handleSalvarPerfil()` --calls--> `updateUserProfileSettings()`  [INFERRED]
  C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\app\(dashboard)\perfil\page.tsx → C:\Users\Christian\Documents\Desenvolvimento\Projetos\barbeiropass\barbeiropass\src\app\(dashboard)\perfil\actions.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (10): getBarbershopPinAction(), buscarClientes(), onSubmit(), carregarPerfil(), fetchClientes(), handleSalvarPerfil(), init(), loadData() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (6): fetchServicos(), handleDelete(), DELETE(), GET(), POST(), PUT()

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (7): processCheckout(), quickCreateClient(), handleCheckout(), handleFormSubmit(), handleQuickCreateClient(), handleStartSale(), selectSuggestedItem()

### Community 3 - "Community 3"
Cohesion: 0.35
Nodes (11): getBarbershopId(), refreshOnboardingScore(), syncMyOnboardingScore(), updateAppearance(), updateBarbershopSettings(), updateBusinessHours(), updateLocation(), updateUserProfileSettings() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (10): addManualClientAction(), generateNewPinAction(), joinQueueAction(), submitReviewAction(), updateQueueStatusAction(), handleAddManual(), handleGeneratePin(), handleJoin() (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (5): confirmDelete(), fetchStaff(), handleCreateStation(), handleDeleteStation(), handleToggleStatus()

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (3): AppSidebar(), SidebarMenuButton(), useSidebar()

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (5): registerBarbershop(), registerProfile(), GoogleIcon(), handleGoogleLogin(), onSubmit()

### Community 8 - "Community 8"
Cohesion: 0.2
Nodes (0): 

### Community 9 - "Community 9"
Cohesion: 0.32
Nodes (4): getAppointmentsAction(), updateAppointmentStatusAction(), fetchAgendamentos(), updateStatus()

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (1): onSubmit()

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (2): createClientAction(), onSubmit()

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (2): middleware(), updateSession()

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 22`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `layout.tsx`, `DashboardLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `page.tsx`, `EnderecoPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `edit-staff-button.tsx`, `EditStaffButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `onboarding-celebration.tsx`, `OnboardingCelebration()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `onboarding-success-banner.tsx`, `OnboardingSuccessBanner()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `providers.tsx`, `Providers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `service-details-dialog.tsx`, `ServiceDetailsDialog()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `teste-invasao.tsx`, `BotaoTesteInvasao()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `update-service-dialog.tsx`, `onSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `Badge()`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `form.tsx`, `useFormField()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `input.tsx`, `Input()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `label.tsx`, `Label()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `skeleton.tsx`, `Skeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `textarea.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `tooltip.tsx`, `TooltipContent()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `use-mobile.ts`, `useIsMobile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `client.ts`, `createClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `eslint.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `global.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `dashboard-chart.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `onboarding-progress.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `command.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `popover.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `progress.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `separator.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `sonner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `switch.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `tabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `supabase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `use-pdv-store.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Select()` connect `Community 0` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 9`, `Community 10`, `Community 13`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 3` to `Community 0`, `Community 1`, `Community 4`, `Community 5`, `Community 7`, `Community 9`, `Community 13`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `fetchStaff()` connect `Community 5` to `Community 0`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `Select()` (e.g. with `registerBarbershop()` and `GET()`) actually correct?**
  _`Select()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 24 inferred relationships involving `createClient()` (e.g. with `registerProfile()` and `registerBarbershop()`) actually correct?**
  _`createClient()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `GET()` (e.g. with `createClient()` and `Select()`) actually correct?**
  _`GET()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `getBarbershopId()` (e.g. with `createClient()` and `Select()`) actually correct?**
  _`getBarbershopId()` has 2 INFERRED edges - model-reasoned connections that need verification._