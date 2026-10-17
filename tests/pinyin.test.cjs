const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const qml = fs.readFileSync(path.join(root, "PinyinLauncher.qml"), "utf8");

function loadScript(filename, bindings = {}) {
    const context = vm.createContext(bindings);
    const source = fs.readFileSync(path.join(root, filename), "utf8")
        .replace(/^\.(?:pragma|import).*$/gm, "");
    vm.runInContext(source, context, { filename });
    return context;
}

function loadPlugin(visible, native = []) {
    const data = loadScript("PinyinData.js");
    const pinyin = loadScript("Pinyin.js", { Data: data });
    const calls = { launches: [], history: [], errors: [] };
    const context = vm.createContext({
        Pinyin: pinyin,
        AppSearchService: {
            getVisibleApplications: () => visible,
            searchApplications: () => native
        },
        DesktopEntries: {
            heuristicLookup: id => visible.find(app => app.id === id)
        },
        SessionService: {
            launchDesktopEntry: app => calls.launches.push(app.id)
        },
        AppUsageHistoryData: {
            addAppUsage: app => calls.history.push(app.id)
        },
        ToastService: {
            showError: (...args) => calls.errors.push(args)
        },
        console: { warn() {} }
    });
    // 执行实际 QML 中的业务函数，桌面服务使用替身，测试不会启动应用。
    for (const name of ["getItems", "executeItem"]) {
        const match = qml.match(new RegExp("    function " + name + "\\([^]*?\\n    \\}"));
        assert.ok(match, `QML function ${name}`);
        vm.runInContext(match[0], context);
    }
    return { plugin: context, pinyin, calls };
}

const examples = [
    ["微信", "weixin", "wx"],
    ["腾讯会议", "tengxunhuiyi", "txhy"],
    ["百度网盘", "baiduwangpan", "bdwp"],
    ["网易云音乐", "wangyiyunyinyue", "wyyyy"],
    ["重庆银行", "chongqingyinhang", "cqyh"],
    ["QQ音乐", "qqyinyue", "qqyy"],
    ["WPS 办公", "wpsbangong", "wpsbg"],
    ["檔案管理員", "danganguanliyuan", "dagly"]
];

test("中文、繁体、多音字和中英文混合名称的全拼及首字母", () => {
    const { pinyin } = loadPlugin([]);
    for (const [name, full, initials] of examples) {
        const keys = pinyin.aliases(name);
        assert.deepEqual(Array.from(keys), [full, initials], name);
        assert.ok(pinyin.matchScore(keys, full) > 0);
        assert.ok(pinyin.matchScore(keys, initials) > 0);
    }
});

test("查询忽略大小写、空格、连字符和单引号", () => {
    const { pinyin } = loadPlugin([]);
    assert.equal(pinyin.normalizeQuery(" WEI-XIN "), "weixin");
    assert.equal(pinyin.normalizeQuery("wei xin"), "weixin");
    assert.equal(pinyin.normalizeQuery("xi'an"), "xian");
    assert.equal(pinyin.normalizeQuery("微信"), "");
    assert.equal(pinyin.normalizeQuery("wx; echo test"), "");
});

test("精确匹配优先于部分匹配，英文名称不生成拼音结果", () => {
    const { pinyin } = loadPlugin([]);
    const keys = pinyin.aliases("微信");
    assert.ok(pinyin.matchScore(keys, "weixin") > pinyin.matchScore(keys, "wei"));
    assert.ok(pinyin.matchScore(keys, "wx") > pinyin.matchScore(keys, "w"));
    assert.ok(pinyin.matchScore(keys, "xin") > 0);
    assert.equal(pinyin.matchScore(keys, "missing"), 0);
    assert.equal(pinyin.aliases("Firefox").length, 0);
});

test("插件使用真实 QML 逻辑返回匹配应用，空查询不产生结果", () => {
    const apps = [
        { id: "wechat", name: "微信" },
        { id: "wemeetapp", name: "腾讯会议" }
    ];
    const { plugin } = loadPlugin(apps);
    assert.equal(plugin.getItems("wx")[0].id, "wechat");
    assert.equal(plugin.getItems("WEI XIN")[0].id, "wechat");
    assert.equal(plugin.getItems("txhy")[0].id, "wemeetapp");
    assert.equal(plugin.getItems("")[0], undefined);
    assert.equal(plugin.getItems("微信").length, 0);
});

test("原生搜索已命中的应用不重复显示", () => {
    const app = { id: "wechat", name: "微信" };
    const { plugin } = loadPlugin([app], [app]);
    assert.equal(plugin.getItems("wx").length, 0);
});

test("隐藏和改名后，下一次查询使用最新可见应用名称", () => {
    const apps = [{ id: "wechat", name: "微信" }];
    const { plugin } = loadPlugin(apps);
    assert.equal(plugin.getItems("wx")[0].id, "wechat");
    apps.splice(0);
    assert.equal(plugin.getItems("wx").length, 0);
    apps.push({ id: "wechat", name: "工作微信" });
    assert.equal(plugin.getItems("gz wx")[0].name, "工作微信");
    assert.equal(plugin.getItems("gongzuoweixin")[0].id, "wechat");
});

test("精确命中排在部分命中之前，最多返回十项", () => {
    const apps = Array.from({ length: 12 }, (_, i) => ({
        id: "wechat-" + i,
        name: "工作微信" + i
    }));
    apps.push({ id: "wechat", name: "微信" });
    const { plugin } = loadPlugin(apps);
    const items = plugin.getItems("wx");
    assert.equal(items.length, 10);
    assert.equal(items[0].id, "wechat");
    assert.ok(items.every(item => item._preScored > 0));
});

test("启动调用沿用 DMS 服务并记录使用历史", () => {
    const { plugin, calls } = loadPlugin([{ id: "wechat", name: "微信" }]);
    plugin.executeItem({ id: "wechat" });
    assert.deepEqual(calls.launches, ["wechat"]);
    assert.deepEqual(calls.history, ["wechat"]);
    assert.equal(calls.errors.length, 0);
});

test("应用已卸载时报告错误，不调用启动服务", () => {
    const { plugin, calls } = loadPlugin([]);
    plugin.executeItem({ id: "removed" });
    assert.equal(calls.errors.length, 1);
    assert.equal(calls.launches.length, 0);
    assert.equal(calls.history.length, 0);
});

test("首次初始化补齐默认值，同时保留已有用户配置", () => {
    const init = qml.match(/    Component.onCompleted: \{([^]*?)\n    \}/);
    assert.ok(init);
    for (const existing of [{}, { noTrigger: false, trigger: "py" }]) {
        const state = { ...existing };
        const context = vm.createContext({
            pluginService: {
                loadPluginData: (id, key, fallback) => state[key] === undefined ? fallback : state[key],
                savePluginData: (id, key, value) => state[key] = value
            }
        });
        vm.runInContext("(function() {" + init[1] + "})()", context);
        assert.deepEqual(state, existing.noTrigger === undefined
            ? { noTrigger: true, trigger: "" }
            : existing);
    }
});
