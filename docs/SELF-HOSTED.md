# ZTools 自建版（HunterXing/ZTools fork）

在 debian（无头服务器）上构建运行的 Linux 版 ZTools，**只使用自建同步服务，不连接任何 ZTools 官方服务**。

## 背景

上游 `ZToolsCenter/ZTools` 从 v3.0.2 到 v3.3.0-beta.2 全部 release **均无 Linux 产物**，CI 也只构建 mac/win。
本 fork 自行构建 Linux 包，并剥离官方服务依赖。

## 剥离内容

| 隐私收集点                 | 上游行为                                                                               | 本 fork 处理                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activityHeartbeatService` | 每 30 分钟向 `z-tools.top/api/activity/heartbeat` 上报 deviceId / uid / 应用版本       | **服务文件已删除**，`appMain.ts` 启停与 `sync.ts` 全部 7 处调用已摘除                                                                                |
| 官方账号                   | 登录 `z-tools.top`，持有 access/refresh token                                          | `normalizeOfficialSession` 恒返回 `null`，所有官方账号态不可达                                                                                       |
| 官方 AI 服务               | 模型目录、积分、签到、充值全部打 `z-tools.top`                                         | `OfficialAIService.officialDisabled` 守卫：9 个对外方法入口短路，`requestAuthenticated` 统一抛错，**永不出站**                                       |
| 官方登录 UI                | 侧边栏头像区「注册/登录 ZTools」+ GitHub 登录对话框                                    | 改为「数据同步」入口，直接跳转 Sync 设置页；`/account` 路由移除                                                                                      |
| 应用更新                   | 查 `github.com/ZToolsCenter/ZTools` release                                            | `electron-builder.yml` 的 `publish.owner` 改为 `HunterXing`                                                                                          |
| 赞助入口                   | 关于页「赞助支持」卡片跳 `afdian.com/a/ZTools`；AI 积分页「赞助送积分」打 `ifdian.net` | 卡片与 `openSponsor` 已删除；`afdianPaymentWindow` 的弹窗白名单收窄到 localhost；`AFDIAN_CHECKOUT_HOST` 与 E2E 充值 URL 改为 `official.invalid` 哨兵 |
| 第三方收银台白名单         | `afdian.com` / `alipay.com` / `weixin.qq.com` / `tenpay.com` 均在隐藏窗口白名单内      | 全部移除（`afdianPaymentWindow.ts`）                                                                                                                 |

### 保留项（有意为之）

- **`syncClient.ts` 的 WebSocket 保活 ping**（每 30s 发 `ping`）——这是自建同步协议的连接保活，发往自建服务器，必须保留。
- **`LEGACY_OFFICIAL_SYNC_SERVER_URLS` 白名单**（`wss://z.zosen.link` / `wss://z-tools.top`）——仅用于**识别并拒绝**旧版本遗留数据，不作连接目标。
- **`OfficialAiCredits.vue` 组件源码**——已被 `v-if="officialProvider.loggedIn"` 挡住，官方账号恒 false 故永不渲染。保留源码而非物理删除，删除属不可逆动作。

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

## debian 部署（桌面模式 + systemd 开机自启）

**当前形态：挂 GNOME 物理屏 `:1`（1920×1080），当桌面应用用。**
2026-10-17 由「Xvfb 虚拟屏 :99 无头模式」改来——虚拟屏里窗口在 GNOME 上看不见，
老邢要的是能看见、能当 uTools 启动器用。

- `ztools.service` —— `WantedBy=graphical-session.target`，`Environment=DISPLAY=:1`
- `xvfb-ztools.service` —— **已停用**（unit 文件保留可回退）
- `~/.local/share/applications/ztools.desktop` —— GNOME 应用菜单条目
- `Linger=yes`，用户级服务无需登录即开机常驻

```bash
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user daemon-reload
systemctl --user enable --now ztools.service
```

自查脚本：`~/.local/bin/ztools-status.py`（进程 / 显示屏 / 物理屏窗口 / 同步 / 官方出站）

**验证窗口真的在物理屏上**（不是只看进程活着）：

```bash
DISPLAY=:1 xwininfo -root -children | grep ZTools
# 期望：0x... "ZTools": ("ztools" "ZTools")  800x58+560+256
```

### 环境事实

| 项                 | 值                       |
| ------------------ | ------------------------ |
| GNOME 会话 display | `:1`（1920×1080 物理屏） |
| 备用 display       | `:2`（1280×800）         |
| 原虚拟屏           | `:99`（Xvfb，已停）      |

### 历史坑（改物理屏后仍适用）

1. **`/tmp/.X99-lock` 冲突**：手工起的 Xvfb 占着 lock 时，systemd 的 Xvfb 会以
   `Fatal server error: Server is already active for display 99` 退出（`status=1/FAILURE`），
   而 ZTools 靠脚本内 `pgrep` 兜底仍能跑——**看起来正常，实际 Xvfb 已脱离 systemd 管理**。
   切换时须先 `pkill -f 'Xvfb :99'` 并 `rm -f /tmp/.X99-lock /tmp/.X11-unix/X99`。
2. **systemd 模式日志在 journalctl**：`~/.ztools/logs/*.log` 是脚本 `--daemon` 模式才写的，
   走 systemd 时 stdout 进 `journalctl --user -u ztools`。查同步日志别只看前者。
3. **`XDG_RUNTIME_DIR` / `XAUTHORITY` 必须显式给**：user unit 里缺失会让 Electron 报
   `The name org.freedesktop.Desktop was not provided`。

## 已踩的坑

1. **`ERR_PNPM_IGNORED_BUILDS`**：pnpm 12 的 `allowBuilds` 白名单缺 `electron-winstaller`，install 前置检查直接失败。已补进 `pnpm-workspace.yaml`。
2. **`Cannot find package 'unocss'`**：设置插件用独立锁文件，需在 `internal-plugins/setting` 下单独 `pnpm install --ignore-workspace`。上游 CI 有这一步，本地易漏。
3. **Electron 二进制下载挂死**：`node_modules/electron/install.js` 直连 GitHub 时 240 秒无任何输出。设 `ELECTRON_MIRROR` 走 npmmirror 后 3 秒完成。**每次构建都要设**。
4. **批量 `str.replace` 因缩进不匹配静默失败**：剥离 `activityHeartbeatService.runNow()` 时，7 处调用缩进各不相同（6/8/10 空格），固定缩进的 replace 只删掉 1 处且不报错。最终按「整行 trim 后等于目标」逐行删除才干净。**改完必须用 LSP diagnostics 或 typecheck 复核**。

## 验证

```bash
pnpm typecheck    # 必须 0 error

# 产物内官方域名清点：只剩迁移白名单的识别字符串
python3 - <<'EOF'
import subprocess
ASAR = "dist/linux-unpacked/resources/app.asar"
s = subprocess.run(["strings", "-n", "6", ASAR], capture_output=True, text=True).stdout
for n in ("z-tools.top", "zosen.link", "afdian.com", "ifdian.net", "赞助支持", "official.invalid"):
    print(f"  {n:20} {s.count(n)}")
EOF
```

预期：`z-tools.top` / `zosen.link` 少量（迁移白名单），`afdian.com` / `ifdian.net` / `赞助支持` **全为 0**。

运行期核验（零官方出站）：

```bash
~/.local/bin/ztools-status.py    # 官方域名命中应为 0
```
