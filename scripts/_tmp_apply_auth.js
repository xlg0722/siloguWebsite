const fs = require('fs');
const crypto = require('crypto');

const EXPECT = 'ecb3f1a5484f7289bc3432c45c217b4ca3a940fc';
const HUNKS = [{"aStart":1047,"removed":["        userPostsBox.textContent = '加载中…';"],"inserted":["        userPostsBox.textContent = '';","        if (window.SilguLoader) {","            const box = document.createElement('div');","            box.className = 'area-loader area-loader--flow';","            box.appendChild(window.SilguLoader.dots());","            userPostsBox.appendChild(box);","        } else {","            userPostsBox.textContent = '加载中…';","        }"]},{"aStart":2232,"removed":[],"inserted":["    // 局部加载圆圈：只在指定区域显示，不遮住整页","    function setAreaLoading(el, on) {","        if (!el) return;","        if (on) {","            if (!el.firstChild && window.SilguLoader) el.appendChild(window.SilguLoader.dots());","            el.hidden = false;","        } else {","            el.hidden = true;","        }","    }",""]},{"aStart":2251,"removed":["        // 好友页打开时用全屏圆圈，避免好友列表空白"],"inserted":["        // 好友页只让「我的好友」这块显示圆圈，上方的搜索和标题保持可见可点"]},{"aStart":2253,"removed":["        if (onFriendsPage && window.SilguLoader) window.SilguLoader.show();"],"inserted":["        const friendsLoading = document.getElementById('friends-loading');","        if (onFriendsPage) setAreaLoading(friendsLoading, true);"]},{"aStart":2264,"removed":["            if (onFriendsPage && window.SilguLoader) window.SilguLoader.hide();"],"inserted":["            if (onFriendsPage) setAreaLoading(friendsLoading, false);"]},{"aStart":2445,"removed":["        if (window.SilguLoader) window.SilguLoader.show();"],"inserted":["        const chatLoading = document.getElementById('chat-loading');","        setAreaLoading(chatLoading, true);"]},{"aStart":2465,"removed":["            if (window.SilguLoader) window.SilguLoader.hide();"],"inserted":["            setAreaLoading(chatLoading, false);"]},{"aStart":2472,"removed":["        if (window.SilguLoader) window.SilguLoader.hide();"],"inserted":["        setAreaLoading(chatLoading, false);"]},{"aStart":3112,"removed":["    // 「加载更多」按钮的显示与加载中状态"],"inserted":["    // 「加载更多」按钮的显示与加载中状态（加载时由帖子区左下角的圆圈提示）"]},{"aStart":3115,"removed":["        communityMoreBtn.hidden = !communityHasMore;"],"inserted":["        communityMoreBtn.hidden = !communityHasMore || communityLoadingMore;"]},{"aStart":3117,"removed":["        communityMoreBtn.textContent = communityLoadingMore ? '加载中…' : '加载更多';"],"inserted":["        communityMoreBtn.textContent = '加载更多';"]},{"aStart":3510,"removed":["        list.textContent = '加载中…';"],"inserted":["        list.textContent = '';","        if (window.SilguLoader) {","            const box = document.createElement('div');","            box.className = 'area-loader area-loader--flow';","            box.appendChild(window.SilguLoader.dots());","            list.appendChild(box);","        } else {","            list.textContent = '加载中…';","        }"]},{"aStart":3690,"removed":[],"inserted":["            setAreaLoading(document.getElementById('community-loading'), false);"]},{"aStart":3696,"removed":["        // 首次加载社区时用全屏圆圈，避免列表空白一段时间","        if (!append && window.SilguLoader) window.SilguLoader.show();"],"inserted":["        // 首次加载社区时只在帖子区左下角显示圆圈，发布框和导航仍然可用","        const feedLoading = document.getElementById('community-loading');","        if (!append) setAreaLoading(feedLoading, true);"]},{"aStart":3702,"removed":[],"inserted":["            setAreaLoading(feedLoading, true);"]},{"aStart":3740,"removed":["            if (window.SilguLoader) window.SilguLoader.hide();"],"inserted":["            setAreaLoading(feedLoading, false);"]},{"aStart":3850,"removed":["        if (!append && window.SilguLoader) window.SilguLoader.hide();"],"inserted":["        setAreaLoading(feedLoading, false);"]}];

function blobSha(buf) {
    return crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
}

const file = 'auth.js';
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');
const out = [];
let pos = 0;
for (const h of HUNKS) {
    for (let i = pos; i < h.aStart; i++) out.push(lines[i]);
    pos = h.aStart + h.removed.length;
    for (const line of h.inserted) out.push(line);
}
for (let i = pos; i < lines.length; i++) out.push(lines[i]);

const result = Buffer.from(out.join('\n'), 'utf8');
const sha = blobSha(result);
if (sha !== EXPECT) {
    console.error('sha mismatch: ' + sha + ' expected ' + EXPECT);
    process.exit(1);
}
fs.writeFileSync(file, result);
console.log('applied ' + result.length + ' bytes, sha ' + sha);
