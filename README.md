# DMS 应用拼音搜索

DankMaterialShell 的本地 Launcher 插件。在聚合搜索的“全部”模式中直接输入全拼或首字母，即可查找中文应用，无需命令前缀。

已在 DMS 1.6.3 上验证。插件使用 QML、JavaScript 和内置拼音字表，运行时不依赖 Python、Node.js 或额外安装的拼音库。

## 使用示例

| 应用名 | 全拼 | 首字母 |
| --- | --- | --- |
| 微信 | `weixin` | `wx` |
| 腾讯会议 | `tengxunhuiyi` | `txhy` |
| 百度网盘 | `baiduwangpan` | `bdwp` |
| 网易云音乐 | `wangyiyunyinyue` | `wyyyy` |

支持全拼、首字母的部分匹配，忽略大小写、空格、连字符和拼音分隔用的单引号。
输入至少两个字符时，DMS 的聚合搜索才会查询第三方插件。

插件使用 DMS 当前可见的应用名称，遵守隐藏应用和名称覆盖设置。
原生搜索已经命中的应用不重复显示；空查询不额外列出应用。
结果显示在“应用拼音搜索”分组中，每次最多 10 项。
选中后使用 DMS 原有的应用启动逻辑，并记录应用使用历史。
“应用”独立筛选模式不会查询 Launcher 插件，请使用聚合搜索的“全部”模式。

## 安装与启用

1. 将仓库克隆到 DMS 的用户插件目录：

   ```bash
   git clone https://github.com/penguinway/dms-pinyin-apps.git \
     "${XDG_CONFIG_HOME:-$HOME/.config}/DankMaterialShell/plugins/pinyinApps"
   ```

2. 打开 DMS 设置的插件页，启用“应用拼音搜索”。如果列表中暂未出现插件，可执行：

   ```bash
   dms ipc call plugin-scan scan
   ```

3. 打开聚合搜索，选择“全部”，输入 `wx` 或 `weixin`。插件首次初始化时会自动设置为无前缀搜索。

仓库为私有时，克隆需要相应的 GitHub 访问权限。
如果目标目录已经存在，请先检查已有内容，避免覆盖现有插件。

## 范围与限制

拼音表由 ICU 78.3 生成，随插件一起保存；搜索时无需联网或额外进程。
常见词（如音乐、银行、重庆）有多音字修正；其他多音字使用 ICU 默认读音，部分生僻汉字可能未收录。
文件和文件夹搜索不在本插件的范围内。

## 配置与停用

可在 DMS 设置的插件页停用“应用拼音搜索”。
插件设置保存于 DMS 配置目录的 `plugin_settings.json`，默认路径为 `~/.config/DankMaterialShell/plugin_settings.json`。
以下为对应的配置片段；保留该文件中其他插件已有的设置：

```json
{
    "pinyinApps": {
        "enabled": true,
        "noTrigger": true,
        "trigger": ""
    }
}
```

首次初始化仅补齐缺失的 `noTrigger`、`trigger` 设置，不覆盖用户已有的取值。

## 验证

测试使用 Node.js 内置测试工具，无需安装 npm 依赖；Node.js 仅用于开发验证。

```bash
node --test tests/pinyin.test.cjs
```

如已安装 Qt 的 `qmllint`，还可以检查插件语法：

```bash
qmllint PinyinLauncher.qml Pinyin.js PinyinData.js
```

测试覆盖全拼、首字母、多音字、混合名称、查询归一化、去重、隐藏应用、名称变更、结果数量限制和原生启动调用。
