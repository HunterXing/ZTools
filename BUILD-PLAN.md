# ZTools Linux 自建版 —— 剥离官方服务 + debian 部署计划

## 目标

在 debian（192.168.31.26，无头）上构建并运行自建 Linux 版 ZTools，
同步源对齐 macmini 的自建私服，**不依赖任何 ZTools 官方服务**。

## 已实测的事实（不是猜测）

| 事实                                                                                                      | 证据                                               |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 上游 `ZToolsCenter/ZTools` v3.2.0，仓库 26MB                                                              | `gh api /repos/ZToolsCenter/ZTools`                |
| v3.0.2~v3.3.0-beta.2 共 10 个 release **零 Linux 产物**                                                   | 遍历 `releases?per_page=10` 资产名                 |
| CI `build.yml` 只构建 mac/win                                                                             | workflow matrix 只有 darwin/win32                  |
| 但仓库有 `build:linux` / `build:linux:x64` 脚本                                                           | `package.json` scripts                             |
| `electron-builder.yml` linux target = **AppImage + deb**                                                  | 已读文件第 82-87 行                                |
| debian 有 Node 24.21 / pnpm 12.14 / g++ / make / python3                                                  | `which` 实测                                       |
| debian 无 GUI，有 Xvfb + openbox + AMD iGPU `/dev/dri/renderD128`                                         | `which` + `ls /dev/dri`                            |
| debian 缺 `rpm`（只影响 rpm 目标，AppImage 够用）                                                         | `which rpm` 空                                     |
| debian 磁盘 615G 可用、内存 54G                                                                           | `df -h` / `free -g`                                |
| 同步服务在 **CVM**：容器 `ztools-sync-server`（`happyzxing/ztools-sync-server:latest` v0.1.3）            | `ssh tencent-cvm; docker inspect`                  |
| 同步服务已跑 8 周 healthy，`127.0.0.1:23517` → nginx `ztools.xingheng.work`                               | 同上                                               |
| 账号 `xingheng`，`ALLOW_REGISTRATION=false`（禁注册）                                                     | 同上 env                                           |
| macmini 实际配置：`provider=private, enabled=true, serverUrl=wss://ztools.xingheng.work, syncInterval=30` | 从 `~/.ztools/lmdb/accounts/default/data.mdb` 读出 |
| 官方外呼域名**只有两个**：`z-tools.top`（3 处）、`ifdian.net`（爱发电赞助）                               | 全仓 grep 硬编码域名                               |
| 心跳服务 `activityHeartbeatService` 每 30 分钟上报 deviceId+uid+版本                                      | 读 `heartbeatService.ts`                           |
| 心跳在 `appMain.ts:162` **无条件启动**                                                                    | grep appMain.ts                                    |

## 隐私收集点清单（要剥离的）

| #   | 位置                                                | 行为                                                                          | 处理                                                 |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | `src/main/core/activity/heartbeatService.ts`        | 每 30 min POST `z-tools.top/api/activity/heartbeat`，带 deviceId / uid / 版本 | **删服务 + 摘掉 appMain 启停**                       |
| 2   | `src/main/core/officialAIService.ts`                | 官方 AI 网关 `z-tools.top/api/ai/official/*`、积分/签到/充值                  | **删服务 + 摘调用方**                                |
| 3   | `src/main/core/account/officialAccountService.ts`   | 官方账号登录/token 刷新                                                       | **保留壳**（sync.ts 依赖结构），改为 stub 返回未登录 |
| 4   | `src/main/api/plugin/payment.ts`                    | 爱发电 `ifdian.net/order/create` 赞助                                         | 保留（纯用户主动点击，无自动外呼）                   |
| 5   | `electron-updater`                                  | 检查 `github.com/ZToolsCenter/ZTools` release                                 | **改指自己的 fork**，或关闭                          |
| 6   | `internal-plugins/setting/src/views/AccountSetting` | 官方登录 UI                                                                   | 隐藏入口（保留私服 SyncSetting）                     |

## 任务拆分（每步独立可验证）

| #   | 任务                                                       | 验证命令                                                 | 回退点                |
| --- | ---------------------------------------------------------- | -------------------------------------------------------- | --------------------- |
| 1   | fork + 浅克隆                                              | `git log --oneline -1`                                   | 删目录                |
| 2   | 依赖装完                                                   | `ls node_modules/.bin/electron-builder`                  | 重装                  |
| 3   | **先原样跑一次 build:linux:x64** 验证基线能出包            | `ls -la dist/*.AppImage`                                 | `git checkout .`      |
| 4   | 剥离心跳（任务1）                                          | `grep -rn heartbeat src/ \| wc -l` = 0；`pnpm typecheck` | commit 前             |
| 5   | 剥离官方 AI（任务2）                                       | 同上                                                     |                       |
| 6   | 官方账号改 stub（任务3）                                   | typecheck + 无 z-tools.top 出站                          |                       |
| 7   | updater 改指 fork 或关闭（任务5）                          | `grep -rn "z-tools.top" src/ \| wc -l` = 0               |                       |
| 8   | 设置 UI 隐藏官方登录（任务6）                              | 人工看设置页                                             |                       |
| 9   | typecheck + build:linux:x64 出包                           | `ls -la dist/*.AppImage dist/*.deb`                      |                       |
| 10  | 装 debian + Xvfb 无头启动                                  | `pgrep -f ZTools`                                        | 删 AppImage + 摘 Xvfb |
| 11  | 写同步配置对齐 macmini（LMDB `SYNC/profile` + 账号 token） | 读回 LMDB 校验字段一致                                   | 备份 `~/.ztools`      |
| 12  | 端到端：debian ↔ wss://ztools.xingheng.work ↔ macmini      | macmini 上看同步记录出现 debian 设备                     |                       |

## 关键决策

- **产物形式**：AppImage（免安装、免 rpm）+ deb（apt 友好），两个都出
- **不改上游核心逻辑**：只删外呼点、留结构，避免 fork 长期跟 rebasing 打架
- **私服优先**：`provider=private` 已在 syncProfileService 支持，不需改架构
- **不动 macmini 现有 ZTools**、不动 CVM 同步服务（只读验证）

## 风险

1. `lmdb` / `uiohook-napi` 需要 node-gyp 编译 → 已有 g++/make/python3，应能过
2. `uiohook-napi` 是全局快捷键 hook，**无头下大概率编译过但运行报缺 X display** → 预期降级：不注册全局热键，不影响同步
3. AppImage 在无 FUSE 环境跑不了 → debian 有 fuse3，AppImage 可用；若不行改解包 `dist/linux-unpacked/`
4. Electron 无头渲染需要 `--no-sandbox` → systemd service 里加 flag

## 回退点

- 每任务一个 commit，`git revert <sha>` 即回退
- 部署侧：所有文件在 `~/apps/ztools/`，删目录即回退
- 同步配置：改前 `cp -a ~/.ztools ~/.ztools.bak-$(date +%Y%m%d)`
