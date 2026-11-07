/**
 * 商店条目数据（第一阶段只读）
 * 以后改到 Supabase 表时，这里只保留兜底数据即可。
 * 字段说明：
 *   kind    game | app
 *   url     安装包外链（Gitee / GitHub / 网盘直链）
 *   cover   封面图地址，留空则显示名称首字的渐变封面
 */
window.STORE_ITEMS = [
    {
        id: 'yourworld',
        kind: 'game',
        title: '你的世界',
        summary: '探索、建造，和朋友一起玩的沙盒世界。',
        description: '《你的世界》首个测试版本，适用于 Windows 64 位。下载后解压运行，遇到问题可以在社区里反馈。',
        author: '小龙果',
        version: 'beta v1.0',
        size: '2.5 MB',
        url: 'https://gitee.com/silogu/yourworld/releases/download/beta-v1.0-win64/yourworld-v0.1-win64.zip',
        fileName: 'yourworld-v0.1-win64.zip',
        cover: ''
    },
    {
        id: 'silogu-app',
        kind: 'app',
        title: '小龙果',
        summary: '桌面客户端：社区、好友、聊天和下载，一个窗口搞定。',
        description: '小龙果桌面应用为便携版，不需要安装。下载后直接双击运行，可在设置页里指定下载目录。',
        author: '小龙果',
        version: 'v1.0.1',
        size: '70.7 MB',
        url: 'https://gitee.com/silogu/silogu-app/releases/download/v1.0.1/siloguApp.exe',
        fileName: 'siloguApp.exe',
        cover: ''
    }
];