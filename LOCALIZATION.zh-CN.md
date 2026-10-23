# Ardia 简体中文版

基于上游 [Ardia v0.2.39](https://github.com/mantrakp04/ardia/releases/tag/v0.2.39)，在 [KouriVar/ardia 的 codex/zh-CN 分支](https://github.com/KouriVar/ardia/tree/codex/zh-CN)维护。原项目作者与 Apache-2.0 授权保持不变。

汉化制作：Codex × KouriVar。

## 安装

解压 `Ardia-0.2.39-zh-CN.zip`，将 `Ardia 中文版.app` 拖到“应用程序”，再打开。此包适用于 Apple Silicon，要求 macOS 14 或更新版本。不要覆盖原版。

这是使用本机 Apple Development 证书重新签名的个人试用构建，没有重新进行 Apple 公证。签名和公证是两回事；不要将它当成上游官方发行包。

个人资料文件使用 `~/Library/Application Support/com.kourivar.ardia.zhCN/`，与原版分开。首次启动会建立完成标记，阻止上游的旧版自动迁移流程；不会自动恢复其他浏览器的数据。需要书签时，在“设置 → 通用 → 导入”中手动选择来源。

为防止官方更新覆盖汉化，本构建移除了官方 Sparkle 更新源与公钥，并关闭自动检查和自动安装。后续版本需手动重新构建汉化包。

## 汉化范围与限制

设置各分页、标签页与分组右键菜单、侧栏、命令栏、书签、历史记录、下载、导入、入门引导、媒体控件及相关动态状态使用简体中文。快捷键、内部标识、网页内容、第三方品牌名称和用户自定义名称保持原值。

本包重新编译了此分支的 React Native / Hermes 界面，保留经校验的上游 macOS 原生程序与 Chromium 引擎。当前机器只有 Command Line Tools，没有完整 Xcode，所以没有从头重编译原生应用与 Chromium。顶栏分类、原生“关于”对话框、部分系统或 Chromium 内置界面仍可能显示英文；不宣称百分之百汉化。

原生组件内的 Safe Storage 钥匙串名称沿用上游，文件目录分开不代表钥匙串完全独立。未携带上游 provisioning profile；为匹配本地开发签名，移除了上游限定的应用标识与钥匙串访问组权限。通行密钥、安全付款确认等依赖这些权限的功能未验证，可能不可用。

## 重新打包

先安装此仓库锁定的依赖，再下载上游 `Ardia-0.2.39.zip`。脚本只接受 SHA256 为 `53be1828d32386b95b089c82ec7b13e7375fa3989435af67b59c80ecd41ab7bc` 的正式包。

```sh
python3 scripts/build-zh-cn.py \
  --official-zip /absolute/path/Ardia-0.2.39.zip \
  --output /absolute/path/new-output-directory \
  --identity YOUR_LOCAL_CODESIGN_IDENTITY
```

脚本不会安装应用。它会构建界面、编译首次启动器、更新独立包信息、保留并重新签署各原生组件的必要权限、验证完整签名，再生成 ZIP 和 SHA256 校验文件。输出目录必须不存在，以避免覆盖已有产物。首次启动器的作用仅是为独立包建立迁移完成标记，然后执行同包内的原生程序；测试实例通过 `ARDIA_DATA_DIR` 使用临时目录。

不要将 `ARDIA_DATA_DIR` 用作日常启动环境变量，它会开启上游的测试隔离模式及模拟钥匙串。
