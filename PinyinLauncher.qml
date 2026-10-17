import QtQuick
import Quickshell
import qs.Services
import "Pinyin.js" as Pinyin

Item {
    id: root

    property var pluginService: null
    property string trigger: ""

    signal itemsChanged()

    Component.onCompleted: {
        if (!pluginService)
            return;
        if (pluginService.loadPluginData("pinyinApps", "noTrigger", null) === null)
            pluginService.savePluginData("pinyinApps", "noTrigger", true);
        if (pluginService.loadPluginData("pinyinApps", "trigger", null) === null)
            pluginService.savePluginData("pinyinApps", "trigger", "");
    }

    function getItems(query) {
        var normalized = Pinyin.normalizeQuery(query || "");
        if (!normalized)
            return [];

        var nativeIds = new Set(AppSearchService.searchApplications(query).map(function (app) {
            return app.id;
        }));
        var items = [];
        for (var app of AppSearchService.getVisibleApplications()) {
            if (!app.id || nativeIds.has(app.id))
                continue;
            var keys = Pinyin.aliases(app.name || "");
            var score = Pinyin.matchScore(keys, normalized);
            if (score === 0)
                continue;
            items.push({
                id: app.id,
                name: app.name,
                icon: app.icon || "material:apps",
                comment: app.comment || "",
                keywords: keys,
                categories: ["应用拼音搜索"],
                // 保留归一化后的拼音匹配结果，避免聚合评分再次按中文名称过滤。
                _preScored: score + 900
            });
        }
        items.sort(function (a, b) {
            return b._preScored - a._preScored || a.name.localeCompare(b.name);
        });
        return items.slice(0, 10);
    }

    function executeItem(item) {
        var entry = item && item.id ? DesktopEntries.heuristicLookup(item.id) : null;
        if (!entry) {
            console.warn("pinyinApps: desktop entry not found:", item ? item.id : "");
            ToastService.showError("无法启动应用", "应用可能已被卸载，请重新搜索。");
            return;
        }
        SessionService.launchDesktopEntry(entry);
        AppUsageHistoryData.addAppUsage(entry);
    }

    Connections {
        target: AppSearchService

        function onCacheVersionChanged() {
            root.itemsChanged();
            if (root.pluginService)
                root.pluginService.requestLauncherUpdate("pinyinApps");
        }
    }
}
