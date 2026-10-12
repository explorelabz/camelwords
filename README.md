# CamelWords — 日本向け TOEIC 単語学習アプリ

Expo / React Native / TypeScript 原生开发版。Web 仅用于交互预览，不作为发布产品。首页、学习、词书、队列、熟识筛选、40 题诊断、记录和设置已实现；内置 72 条原创演示内容，全部标为未审校，不能作为正式词库上线。

Android APK 和 iOS 模拟器包已生成，见 [原生构建与安装](docs/BUILD.md)。

## 运行

建议 Node 22、pnpm。先 `pnpm install`。

```sh
pnpm preview                  # http://localhost:8081，浏览器交互预览
pnpm start                    # Expo Development Build，非 Expo Go
pnpm exec expo run:ios        # 需要完成 Xcode 首次运行及许可证确认
pnpm exec expo run:android    # 需要 Android SDK / 模拟器
pnpm typecheck
pnpm test
pnpm test:rules               # 需要 Java 21+；使用 demo 项目本地模拟器
pnpm --filter camelwords-functions build
```

本机附带 Node/pnpm 在 Codex runtime 目录，终端未加入 PATH 时需先加入对应目录。Android Studio 的 Java 位于 `/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin`。

## 已实现的学习规则

- 日本时间 04:00 日界，默认每日 60 词、新词上限 30，固定当日计划。
- 跨书复习优先，再取用户队列，再按当前词书和诊断错词补齐。
- ts-fsrs 调度及 SM-2 替代实现；AGAIN 后移 8 位，HARD 后移 20 位且只重复一次。
- 同日重复仅首次和最终 GOOD 更新长期调度；多次答题仍保留不可变事件。
- 熟识独立于 GOOD，支持撤销、恢复；撤销不会回滚其他单词的后续答案。
- 新词积压阈值暂停/恢复；手动再学 10/20 词；SQLite 本地事务保存、离线 outbox。
- 40 题可选自适应诊断、学前筛选、搜索/批量选词、队列顺序、学习记录。
- 设备 TTS 美音/英音、原生本地通知（需要用户授权）。

## Firebase

项目：`camelwords-881f8`，包名：`jp.camelwords.app`。

- iOS App ID：`1:997615693172:ios:ac6fb67f92ec810e829021`
- Android App ID：`1:997615693172:android:a56827a4d51eeb5f829021`
- Firestore：`(default)`，`asia-northeast1`，匿名认证已开启。
- Storage：`camelwords-881f8.firebasestorage.app`，东京区域。
- 云函数代码：事件重放、账号删除、每日统计，最大实例数 2。

两份原生配置 `GoogleService-Info.plist` 和 `google-services.json` 已下载至项目根目录，并已加入 gitignore；不要放入服务账号私钥。`app.config.ts` 检测到两份文件后启用 RN Firebase 插件。

Google 登录按用户选择暂不启用，`extra.googleSignInEnabled` 为 `false`，即使以后配置文件出现 OAuth client 也不会自行开放入口。未来启用需配置 Firebase Google 提供方、登记 Android 签名 SHA、重新下载 OAuth 配置，再明确打开开关。Apple 登录需完成 Firebase 提供方、Apple Developer 的 App ID / Sign In with Apple 配置和签名，再将 `extra.appleSignInEnabled` 打开。当前使用匿名认证；尚不能通过身份提供方在另一台设备恢复匿名账号。

```sh
pnpm exec firebase login
pnpm --filter camelwords-functions build
pnpm exec firebase deploy --only firestore,storage,functions --project camelwords-881f8
```

安全规则：用户只能访问自己的记录；答题/状态事件只准创建，禁止覆盖和删除；`wordStates` 仅后端写入；删除墓碑阻止旧令牌重建数据。事件重放共享客户端调度代码，避免离线乱序消息将熟识词重新加入复习。

Callable 入口与数据权限分开：客户端使用 Firebase ID token，处理函数会验证身份并只取 `request.auth.uid`。删除入口的 Cloud Run 调用权限已在用户确认后配置，真实账号删除验证已通过，详见 `docs/STATUS.md`；接口认证机制参考 [Firebase callable 官方说明](https://firebase.google.com/docs/functions/callable)。

队列和日计划按设备保存，账号恢复时去重合并事件与已完成项目；并非实时多设备协同编辑。两个离线设备分别建立的当日计划合并后可能超过设置的每日量，这是需要在正式多设备验收中确定的策略。

## 内容包工具

输入为设计书 schema 1.0 的 `manifest.json`、CSV 及 MP3。支持本地校验、编译、打包、云端差异、发布与版本回滚。云端操作使用 Application Default Credentials 或 `GOOGLE_APPLICATION_CREDENTIALS`，并显式指定项目。

```sh
pnpm content validate ./content-package
pnpm content compile ./content-package
pnpm content pack ./content-package
pnpm content dry-run ./content-package --project camelwords-881f8
pnpm content publish ./content-package --project camelwords-881f8 --bucket camelwords-881f8.firebasestorage.app --reviewed-by editor-name
pnpm content rollback toeic-600 --to 1.0.0 --project camelwords-881f8
```

发布必须先产生与当前内容 hash、线上基础版本一致的 dry-run 报告。仅 REVIEWED 内容和引用媒体进入编译包；内部备注被移除。校验包含引用、枚举、唯一键、例句标记、MP3 解码/单声道/时长；缺英音、码率差异、长释义给出警告。媒体按 hash 去重，版本对象不可覆盖，先上传再原子切换发布指针。回滚只更改指针，不删除历史文件。

当前内容工具只接受包内 relation 引用；Sheets 直接拉取、App 动态内容增量下载、音频响度/首尾静音及封面比例检查尚未完成。发布流程尚未使用正式内容及线上 Admin 凭据做端到端验收。

## 尚需完成的发布工作

- 约 3,100 条正式词库、母语审校、正式音频和内容版权信息。
- 真机验证 SQLite、音频、通知和账号删除；身份登录及跨设备恢复需在提供方启用后另行验证。
- App 内容增量下载与音频缓存、完整 Analytics 漏斗与 Remote Config 开关。
- 隐私政策/服务条款、商店元数据、开发者签名及 App Store / Play Console 发布。
- 生产索引和 Functions 部署状态请以 `docs/STATUS.md` 为准。
