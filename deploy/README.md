# 部署文件

放到 debian 上的 systemd user unit 与 GNOME 菜单条目。机器上的实际位置：

| 仓库内           | 机器上                                       |
| ---------------- | -------------------------------------------- |
| `ztools.service` | `~/.config/systemd/user/ztools.service`      |
| `ztools.desktop` | `~/.local/share/applications/ztools.desktop` |

应用：

```bash
install -Dm755 ztools.service  ~/.config/systemd/user/ztools.service
install -Dm755 ztools.desktop ~/.local/share/applications/ztools.desktop
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user daemon-reload
systemctl --user enable --now ztools.service
```

启动脚本不在仓库（依赖本机路径），见 `~/.local/bin/ztools-start.sh`。
`xvfb-ztools.service` 已停用但 unit 文件仍在 `~/.config/systemd/user/` 里，可随时回退到无头模式。
