# 验证总结

日期：2026-03-25  
执行者：Codex

## 已验证项

- `bun run lint`：通过（`Checked 116 files in 21ms`）
- `bun run typecheck`：通过
- `bun test`：通过（249 个测试）
- `bun run build`：通过

## 本轮完成项

- 已为 `packages/scanner-core` 新增 `openclaw-feed.ts`，提供：
  - GitHub releases / commits 上游快照抓取
  - OSV advisory feed 查询
  - advisory 与版本数据库合并
- 已为 `packages/scanner-core/src/version-db.ts` 增加 `buildVersionDatabaseFromSnapshot()`，支持基于实时 snapshot 派生版本基线。
- 已在 `packages/scanner-core/src/index.ts` 导出 feed 能力与相关类型，便于 web/extension 共享复用。
- 已新增 `apps/web/src/intelligence-store.ts`，使用既有 `app_meta` 缓存：
  - `intelligence_upstream_snapshot`
  - `intelligence_advisory_feed`
  - `intelligence_refreshed_at`
  - `intelligence_refresh_error`
- 已将 `apps/web/src/intelligence.ts` 重构为 `buildIntelligenceOverview()` + `getIntelligenceOverview()`，支持注入动态 snapshot、版本库与社区部署影响数。
- 已让 `/api/community/intelligence*` 路由改为优先读取数据库缓存，在无缓存或缓存损坏时自动回退静态 overview。
- 已让 worker 增加 `scheduled` intelligence refresh 入口，并在 `apps/web/wrangler.toml` 配置 cron triggers。
- 已让 intelligence advisory 结合 `community_reports.platform_version` 聚合结果，在信号中显示社区已观测部署数量。
- 已新增 community threat signals 聚合：基于 `community_reports` 与 `findings` 生成匿名部署严重度集中度、最高频问题与近 30 天低分压力信号，并接入 intelligence overview / route / 页面展示。
- 已新增 `/api/community/intelligence/community` 端点，用于返回 community threat signals。
- 已新增 `packages/scanner-core/src/checks/passive/csp-deep-audit.ts`，用于分析 `Content-Security-Policy` 的脚本执行风险、宽泛来源、`object-src`、`base-uri` 与 `frame-ancestors` 配置强度。
- 已将 `CSP deep audit` 在 `ROADMAP.md` 中标记为完成，并同步更新当前测试数与 scanner checks 数量。
- 已新增 `packages/scanner-core/src/checks/passive/api-key-exposure.ts`，用于扫描公开响应 body/headers 中的高信号 API key / token 泄露模式，并对证据做截断掩码。
- 已将 `API key exposure` 在 `ROADMAP.md` 中标记为完成，并同步更新当前测试数与 scanner checks 数量。

## 新增验证覆盖

- `packages/scanner-core/tests/openclaw-feed.test.ts`
- `apps/web/tests/intelligence-store.test.ts`
- `apps/web/tests/intelligence.test.ts`
- `apps/web/tests/routes.test.ts`
- `apps/web/tests/worker.test.ts`

## 当前结论

项目当前主线可 lint、可编译、可构建、可测试；intelligence 自动刷新与真实 advisory feed 接入已在本地完成闭环，并与既有 extension 复用 scanner-core、queue 测试稳定化、web intelligence 展示链路兼容共存。
