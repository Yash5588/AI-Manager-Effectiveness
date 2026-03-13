# Dependency Map

## Backend

- `server/controllers/managerAnalyticsController.js`
  - depends on `server/services/managerAnalyticsService.js`
  - depends on `server/services/employeeCoachingService.js`
  - depends on `server/services/aiSuggestionsService.js`
  - depends on `server/services/attritionService.js`
  - depends on `server/services/aiScoringService.js`
  - depends on `server/models/*`

- `server/routes/hrRoutes.js`
  - depends on `server/services/managerAnalyticsService.js`
  - depends on `server/services/reportService.js`
  - depends on `server/services/emailService.js`
  - depends on `server/models/User.js`
  - depends on `server/models/Feedback.js`

- `server/services/reportService.js`
  - depends on `server/services/managerAnalyticsService.js`
  - depends on `server/models/User.js`
  - depends on `server/models/ScoreSnapshot.js`

- `server/schedulers/snapshotScheduler.js`
  - depends on `server/services/managerAnalyticsService.js`
  - depends on `server/services/aiScoringService.js`
  - depends on `server/models/User.js`
  - depends on `server/models/ScoreSnapshot.js`

- `server/services/managerAnalyticsService.js`
  - centralizes feedback window helpers, score computation inputs, score aggregation, trend lookup, peer timeline helpers
  - depends on `server/utils/scoring.js`
  - depends on `server/models/User.js`
  - depends on `server/models/Feedback.js`
  - depends on `server/models/PerformanceMetric.js`
  - depends on `server/models/ManagerExtendedMetrics.js`
  - depends on `server/models/ScoreSnapshot.js`

- `server/services/employeeCoachingService.js`
  - centralizes coaching profile and team metric shaping
  - depends on `server/services/attritionService.js`

## Frontend

- `client/src/pages/Index.tsx`
  - composes manager dashboard tabs
  - depends on `client/src/lib/api.ts`
  - depends on `client/src/components/tabs/*`

- `client/src/components/tabs/OverviewTab.tsx`
  - depends on `client/src/components/ScoreTrendChart.tsx`
  - depends on `client/src/components/ImprovementJourneyModal.tsx`

- `client/src/components/ScoreTrendChart.tsx`
  - depends on `client/src/lib/api.ts`
  - renders score history plus peer benchmark fallback logic

- `client/src/lib/api.ts`
  - central API layer for manager, HR, coaching, trends, and leaderboard flows

- `client/src/lib/peerTrendBenchmark.ts`
  - centralizes non-UI peer benchmark fallback shaping used by the trend chart

- `client/src/lib/metricLabels.ts`
  - centralizes shared KPI display labels used by overview and detail views

## Refactor Targets Identified

- Shared backend score/query logic was duplicated across controller, routes, report service, and scheduler.
- Coaching profile shaping was duplicated inside two controller endpoints.
- `client/src/components/AnalyticsCharts.tsx` was dead code and not referenced by the dashboard anymore.
