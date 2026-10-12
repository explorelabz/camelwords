# CamelWords 开发状态

更新日期：2026-10-11（日本时间）。这是可交互开发版，尚未达到商店发布条件。

## 本地 App

- 已实现：首页、学习卡片、三档自评、熟识/撤销/恢复、词书、搜索与批量选词、跨书队列、熟识筛选、40 题诊断、记录和设置。
- 已实现：JST 04:00 日界、固定日计划、FSRS/SM-2、积压暂停、离线 outbox、SQLite 持久化及按事件合并恢复。
- 已接入：原生 Firebase 匿名认证与同步、TTS、本地通知、账号删除。
- Google 登录按用户要求关闭；Apple 登录尚未配置，入口也关闭。身份绑定代码已有，尚未真机验收。
- Web 是本地交互预览，使用 localStorage，不连接正式 Firebase，也不替代原生测试。
- 预览地址：http://localhost:8081/（需本地开发服务运行）。

## 云端

- 项目：`camelwords-881f8`，已升级 Blaze。
- 原生 iOS / Android 应用已注册，配置文件已下载。
- 匿名认证已开启；Google 认证保持关闭。
- Firestore 默认库与 Storage 位于东京；安全规则和 Firestore 索引已发布。
- 四个东京区云函数已部署：`onReviewEventCreated`、`onStateEventCreated`、`deleteAccount`、`dailyStats`。构建镜像设为 1 天自动清理。
- `deleteAccount` 的 Cloud Run 调用权限已在用户明确确认后修复，仅此服务允许公开调用入口；callable 仍验证 Firebase 身份并限定删除本人。

## 验证记录

- `pnpm typecheck`：通过。
- `pnpm export`：Web 打包通过。
- `pnpm test`：23 项通过（学习规则、内容校验、事件重放与合并）。
- Firestore 模拟器：5 项安全规则测试通过（隔离、不可变事件、服务器专有字段、删除墓碑及发布内容）。
- Expo iOS / Android Hermes bundle 导出：通过。此结果不代表原生安装、签名或真机测试通过。
- Android ARM64 Release APK 与 iOS ARM64 Release 模拟器应用：原生编译成功。APK 使用测试签名且校验通过；iOS 包不含实体 iPhone 签名。产物及安装说明见 `docs/BUILD.md`。
- 模拟器交互测试：Mac 锁屏，用户选择稍后验证界面；Android adb 首次安装过程出现 mDNS 线程崩溃，尚未确认安装成功，未做原生交互验收。
- 2026-10-11：用户登录 Xcode 后，Personal Team 签名的真机 Release 已安装到其 iPhone 16 Pro Max；本机签名校验与设备授权检查通过。用户完成开发者信任并解锁后，devicectl 启动成功，后续进程检查确认 CamelWords 仍在运行；完整真机交互流程尚未验收。描述文件有效至日本时间 2026-10-18 00:57。
- 浏览器：390×844 手机尺寸查看首页、词书和学习；答题、熟识撤销、队列选择、40 题诊断及刷新后持久化已验证。
- 正式 Firebase：匿名认证、设置写入、复习事件重放、熟识状态重放、事件不可覆盖和跨用户读取拒绝已通过。未登录删除请求被拒绝，登录用户调用删除接口及其数据清理已通过。
- 首次联调的临时用户及其 Firestore 子树已清理，控制台确认无认证用户。可重复验证脚本：`tools/smoke-firebase.ts`。

## 发布前仍需完成

1. 两端内部测试包已构建，个人签名版已安装到 iPhone；交互验收待完成。商店发布签名与个人短期测试签名需分别配置。
2. 正式词库约 3,100 条、母语审校、授权信息与正式录音。当前 72 条原创演示内容均标记未审校。
3. App 动态内容下载、增量更新和音频缓存；内容工具的线上发布/回滚验收、Sheets 直接拉取、音频响度/首尾静音与封面检查。
4. 身份提供方配置与跨设备恢复验收；两个离线设备合并计划后的每日上限策略尚需确认。
5. 完整 Analytics 漏斗、Remote Config、隐私政策、服务条款、商店元数据与签名发布。当前应用图标已加入。

内容包不得在未审校情况下作为正式 TOEIC 词库发布。当前未向 Storage 发布演示词库。
