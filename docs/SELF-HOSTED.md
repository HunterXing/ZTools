# ZTools 自建版（HunterXing/ZTools fork）

在 debian（无头服务器）上构建运行的 Linux 版 ZTools，**只使用自建同步服务，不连接任何 ZTools 官方服务**。

## 背景

上游 `ZToolsCenter/ZTools` 从 v3.0.2 到 v3.3.0-beta.2 全部 release **均无 Linux 产物**，CI 也只构建 mac/win。
本 fork 自行构建 Linux 包，并剥离官方服务依赖。

## 剥离内容

| 隐私收集点                 | 上游行为                                                                         | 本 fork 处理                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `activityHeartbeatService` | 每 30 分钟向 `z-tools.top/api/activity/heartbeat` 上报 deviceId / uid / 应用版本 | **服务文件已删除**，`appMain.ts` 启停与 `sync.ts` 全部 7 处调用已摘除                                          |
| 官方账号                   | 登录 `z-tools.top`，持有 access/refresh token                                    | `normalizeOfficialSession` 恒返回 `null`，所有官方账号态不可达                                                 |
| 官方 AI 服务               | 模型目录、积分、签到、充值全部打 `z-tools.top`                                   | `OfficialAIService.officialDisabled` 守卫：9 个对外方法入口短路，`requestAuthenticated` 统一抛错，**永不出站** |
| 官方登录 UI                | 侧边栏头像区「注册/登录 ZTools」+ GitHub 登录对话框                              | 改为「数据同步」入口，直接跳转 Sync 设置页；`/account` 路由移除                                                |
| 应用更新                   | 查 `github.com/ZToolsCenter/ZTools` release                                      | `electron-builder.yml` 的 `publish.owner` 改为 `HunterXing`                                                    |

### 保留项（有意为之）

- **`syncClient.ts` 的 WebSocket 保活 ping**（每 30s 发 `ping`）——这是自建同步协议的连接保活，发往自建服务器，必须保留。
- **`LEGACY_OFFICIAL_SYNC_SERVER_URLS` 白名单**（`wss://z.zosen.link` / `wss://z-tools.top`）——仅用于**识别并拒绝**旧版本遗留数据，不作连接目标。
- **`ifdian.net`（爱发电赞助）**——用户主动点击才打开浏览器，无自动上报。若要彻底移除见下方「待办」。

### 官方地址哨兵

`src/shared/syncServerUrl.ts` 中「官方地址」保留为语义判据（区分 `official` / `private` 部署模式），
但取值改为不可路由的保留域名 `https://official.invalid`——即便有代码路径误用也无法真正出站。

## 自建同步配置

- 同步服务地址：`wss://ztools.xingheng.work`（`SELF_HOSTED_SYNC_SERVER_URL`）
- 默认部署模式：`private`（`normalizeProfile` 中未显式配置时即回落到自建源）
- 服务端：腾讯云 CVM 上的 `happyzxing/ztools-sync-server` 容器，账号 `xingheng`，`ALLOW_REGISTRATION=false`
- macmini 已有配置：`provider=private, enabled=true, serverUrl=wss://ztools.xingheng.work, syncInterval=30min`

## 在 debian 上构建

前置（已装）：Node 24、pnpm 12、g++/make/python3、fuse3。
debian **无 rpm**，只影响 rpm 目标，AppImage / deb 不受影响。

```bash
cd /home/xingheng/projects/ztools
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
# Electron 二进制走国内镜像，否则 postinstall 会挂住（实测 240s 无输出）
export ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/

pnpm install --frozen-lockfile
# 设置插件使用独立锁文件，必须单独装（否则 vite 找不到 unocss）
cd internal-plugins/setting && pnpm install --frozen-lockfile --ignore-workspace && cd ../..
cd internal-plugins/setting && pnpm install --frozen-lockfile --ignore-workspace 2>/dev/null  # 幂等

pnpm run build:linux:x64     # 产出 dist/*.AppImage + dist/*.deb
```

产物：

- `dist/ZTools-3.2.0-linux-x86_64.AppImage`（约 116 MB）
- `dist/ZTools_3.2.0_amd64.deb`（约 79 MB）

## 已踩的坑

1. **`ERR_PNPM_IGNORED_BUILDS`**：pnpm 12 的 `allowBuilds` 白名单缺 `electron-winstaller`，install 前置检查直接失败。已补进 `pnpm-workspace.yaml`。
2. **`Cannot find package 'unocss'`**：设置插件用独立锁文件，需在 `internal-plugins/setting` 下单独 `pnpm install --ignore-workspace`。上游 CI 有这一步，本地易漏。
3. **Electron 二进制下载挂死**：`node_modules/electron/install.js` 直连 GitHub 时 240 秒无任何输出。设 `ELECTRON_MIRROR` 走 npmmirror 后 3 秒完成。**每次构建都要设**。
4. **批量 `str.replace` 因缩进不匹配静默失败**：剥离 `activityHeartbeatService.runNow()` 时，7 处调用缩进各不相同（6/8/10 空格），固定缩进的 replace 只删掉 1 处且不报错。最终按「整行 trim 后等于目标」逐行删除才干净。**改完必须用 LSP diagnostics 或 typecheck 复核**。

## 验证

```bash
pnpm typecheck    # 必须 0 error

# 产物内官方域名清点（应只剩白名单与本文档）
strings dist/linux-unpacked/resources/app.asar | grep -oE 'z-tools\.top|zosen\.link|official\.invalid|ztools\.xingheng\.work' | sort | uniq -c
```

## 待办

- 爱发电赞助入口（`afdianPayment.ts`）尚未移除——属用户主动行为，不构成隐私收集，如需彻底去除再改。
- debian 无头运行需 `Xvfb` + `--no-sandbox`，部署脚本见后续提交。
