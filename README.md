# zhNote

zhNote 是一款基于 Tauri 的桌面 Markdown 笔记应用。选择一个文件夹作为笔记库（Vault），即可浏览和管理其中的 Markdown 文件。

## 功能

- Markdown 编辑、即时预览与阅读模式，支持 Mermaid 图表
- 浏览、搜索、创建、重命名、移动和删除笔记及文件夹
- 导出笔记、PDF，以及 Mermaid 图表图片
- 浅色、深色和跟随系统的外观设置
- 使用 Git 初始化笔记库、设置远端，并提交、拉取和推送笔记

## 开发

需要安装 Node.js、pnpm、Rust；macOS 还需要 Xcode Command Line Tools。使用 Git 同步笔记时也需要安装 Git。

```sh
pnpm install
pnpm tauri dev
```

构建前端：

```sh
pnpm build
```

构建桌面应用：

```sh
pnpm tauri build
```

Git 同步会将所选笔记库中的更改加入提交，再从 `origin` 拉取并推送当前分支。请确认该文件夹仅包含希望同步的内容，并已配置远端和 Git 身份信息。
