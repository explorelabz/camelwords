# CamelWords 官网

独立于 Expo App 的日文官网：Next.js / React / Radix UI / Lucide。参考 mikan 的产品介绍结构，沿用 CamelWords 绿色品牌。手机单词卡为交互演示，不保存学习进度。

## 开发与构建

在项目根目录执行：

```sh
pnpm install
pnpm --filter camelwords-website dev
pnpm --filter camelwords-website build
pnpm --filter camelwords-website check:seo
```

预览 http://127.0.0.1:3000 。静态发布目录为 website/out。App 原有 8081 预览独立。

## SEO 与上线

当前未配置正式域名，默认 noindex、robots 禁止抓取，且不生成虚假的 canonical 和站点地图 URL。

1. 从 website/.env.example 创建 website/.env.local。
2. NEXT_PUBLIC_SITE_URL 填入真实 HTTPS 域名（不带路径），例如 https://your-domain.jp。
3. 商店上架后填写真实商店链接，并同时更新首页、FAQ、文章中的开发状态文案。
4. 重新 build，再执行：pnpm --filter camelwords-website check:seo --origin=https://your-domain.jp
5. 将 website/out 部署至支持目录 index.html、404.html 的静态托管，未知路径须返回 HTTP 404，不要配置 SPA 全路径回退。未自动部署或修改现有 Firebase 配置。
6. 确保 HTTPS 与 www/非 www 统一重定向；在 Search Console 验证域名并提交 /sitemap.xml。

10 个内容页：主页、TOEIC 总览、4 个目标分数页、学习指南总览、3 篇文章。全部构建时生成完整 HTML；包含独立标题、描述、Open Graph、Twitter 元数据；正式域名配置后输出 canonical、WebSite / Article / BreadcrumbList JSON-LD。robots 与 sitemap 同样在构建时生成。没有编造下载量、评分、报价或上线日期。

内容集中在 lib/content.ts。文章适合持续人工审校和扩充，不应批量复制近似页面。当前文章为原创学习建议，不代表正式教材或得分保证。没有接入分析追踪、表单或收集联系方式。

布局支持手机及桌面，Radix UI 实现键盘可操作的分数 tabs 和 FAQ。字体通过 Google Fonts CSS 提供，网络不可用时回退到系统字体。正式上线可进一步将字体自托管。
