# 原生构建与安装

2026-10-07，版本 0.1.0，包名 `jp.camelwords.app`。

## 本次交付

| 文件 | 用途 | 签名与限制 |
| --- | --- | --- |
| `artifacts/CamelWords-0.1.0-android-arm64-internal.apk` | Android 7.0+、ARM64 手机或模拟器安装体验 | Release 编译，内置 JS，使用测试证书；不用于商店发布 |
| `artifacts/CamelWords-0.1.0-ios-simulator-arm64.zip` | Apple Silicon Mac 上的 iOS 模拟器 | Release 编译，内置 JS；不能安装到实体 iPhone |
| `artifacts/CamelWords-0.1.0-iphone-personal.ipa` | 当前已注册的个人 iPhone | 2026-10-11 使用 Personal Team 开发签名；描述文件有效至日本时间 2026-10-18 00:57 |
| `artifacts/SHA256SUMS.txt` | 下载完整性校验 | SHA-256 |

两端编译均成功。APK 签名校验通过；iOS 包已检查 bundle ID、版本、ARM64 可执行文件及内置 JS。由于 Mac 锁屏，用户选择稍后验证界面；本次不声称已通过模拟器交互或真机验收。Android 首次安装验证遇到 adb mDNS 线程崩溃，未确认安装成功；测试模拟器已关闭。

应用已连接正式 Firebase 项目 `camelwords-881f8`。Google 登录按用户要求关闭，Apple 登录也尚未开放。当前内置 72 条未审校演示内容，正式词库仍需准备。

## 安装

Android：将 APK 发送至 ARM64 手机，允许该来源安装后打开。开发机连接设备后也可执行：

```sh
~/Library/Android/sdk/platform-tools/adb install -r artifacts/CamelWords-0.1.0-android-arm64-internal.apk
```

iOS：解压 ZIP，启动 Xcode 的 Simulator，将 `CamelWords.app` 拖入模拟器窗口。也可在启动目标模拟器后执行：

```sh
xcrun simctl install booted /完整路径/CamelWords.app
xcrun simctl launch booted jp.camelwords.app
```

2026-10-11 已使用用户登录的 Personal Team 生成开发证书和设备描述文件，完成真机 Release 编译、签名验证，并安装到用户的 iPhone 16 Pro Max。用户完成开发者信任并解锁后，已通过 devicectl 成功启动，并确认应用进程仍在运行；完整真机交互流程尚未验收。此个人签名有有效期，不等同于 TestFlight / App Store 发布签名。Android 商店发布需单独设置持久发布密钥，不能沿用本次测试证书。

真机配置已移除未使用的 APNs 与未开放的 Apple 登录权限；本地学习提醒保留。`plugins/withLocalOnlyCapabilities.js` 会在重新生成原生工程时保持此配置。

## 本机复现

项目根目录包含未提交的 Firebase 原生配置。所需工具已安装在 `.build-tools/`；此目录、原生生成目录和产物不提交版本库。

```sh
export PATH="/Users/pigou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/pigou/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
export JAVA_HOME="$PWD/.build-tools/jdk-17.0.20.1+1/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export GEM_HOME="$PWD/.build-tools/gems"
export PATH="$PWD/.build-tools/portable-ruby/3.4.5/bin:$GEM_HOME/bin:$PATH"
```

Android（已有原生目录时）：

```sh
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=4 --console=plain
```

iOS（已有 Pods 时，在项目根目录）：

```sh
xcodebuild -workspace ios/CamelWords.xcworkspace -scheme CamelWords \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/ios -jobs 4 \
  CODE_SIGNING_ALLOWED=NO ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
```

重新生成原生工程时使用 `pnpm exec expo prebuild --no-install`，随后在 `ios` 目录运行 `pod install`。构建固定使用 JDK 17；Android Studio 自带 Java 25 曾使 CMake 配置失败。Firebase 使用官方插件的 `ios.disableSPM: true` 与静态 CocoaPods，解决默认 SPM 的静态链接冲突。

构建日志：项目根目录 `android-build.log`、`ios-pods.log`、`ios-build.log`。Firebase 可重复联调：`pnpm exec tsx tools/smoke-firebase.ts`，脚本创建一次性匿名账号并在测试后通过 callable 删除。
