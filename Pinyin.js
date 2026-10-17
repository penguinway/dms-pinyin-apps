.pragma library
.import "PinyinData.js" as Data

var _readings = null;
var _aliases = Object.create(null);

// ICU 的逐字读音需要补充部分常见词的多音字读法。
var _phrases = {
    "音乐": ["yin", "yue"],
    "银行": ["yin", "hang"],
    "重庆": ["chong", "qing"],
    "厦门": ["xia", "men"],
    "长安": ["chang", "an"],
    "长城": ["chang", "cheng"],
    "长江": ["chang", "jiang"],
    "长沙": ["chang", "sha"],
    "长春": ["chang", "chun"],
    "会计": ["kuai", "ji"]
};

function readings() {
    if (_readings === null) {
        _readings = Object.create(null);
        for (var syllable in Data.groups) {
            for (var character of Data.groups[syllable])
                _readings[character] = syllable;
        }
    }
    return _readings;
}

function aliases(name) {
    if (_aliases[name] !== undefined)
        return _aliases[name];

    var table = readings();
    var tokens = [];
    var hasChinese = false;
    for (var i = 0; i < name.length; i++) {
        var phrase = _phrases[name.substring(i, i + 2)];
        if (phrase) {
            tokens.push(phrase[0], phrase[1]);
            hasChinese = true;
            i++;
            continue;
        }

        var character = name[i].toLowerCase();
        if (table[character]) {
            tokens.push(table[character]);
            hasChinese = true;
        } else if (/[a-z0-9]/.test(character)) {
            tokens.push(character);
        } else if (/[\u3400-\u9fff\uf900-\ufaff]/.test(character)) {
            // 保留未收录汉字，避免把前后文字误拼成一个可匹配的名称。
            tokens.push(character);
        }
    }

    var result = hasChinese ? [
        tokens.join(""),
        tokens.map(function (token) { return token[0]; }).join("")
    ] : [];
    _aliases[name] = result;
    return result;
}

function normalizeQuery(query) {
    var normalized = query.toLowerCase().replace(/[\s'-]+/g, "");
    return /^[a-z0-9]+$/.test(normalized) ? normalized : "";
}

function matchScore(keys, query) {
    if (!query || keys.length === 0)
        return 0;
    if (keys[0] === query)
        return 4000;
    if (keys[1] === query)
        return 3800;
    if (keys[0].startsWith(query))
        return 2800;
    if (keys[1].startsWith(query))
        return 2600;
    if (keys[0].includes(query))
        return 1800;
    if (keys[1].includes(query))
        return 1600;
    return 0;
}
