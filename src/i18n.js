// Language system.
//
// Keyword DATA is translated in the database: every `name` is a jsonb value
// shaped {"en": "Cat", "vi": "Mèo", ...}. This file covers the static UI chrome
// and mirrors the database helpers (i18n_locales / i18n_text / i18n_missing)
// so the client and Postgres agree on the same rules.
//
// Adding a 6th language: add it to LOCALES here, add it to i18n_locales() in
// the database, and add its unique index. Nothing else changes.

export const PRIMARY = 'en'

export const LOCALES = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
    { code: 'ja', label: '日本語', short: 'JA' },
    { code: 'zh', label: '中文', short: 'ZH' },
    { code: 'ko', label: '한국어', short: 'KO' },
]

export const LANGS = LOCALES.map((l) => l.code)

/** Read one locale off a jsonb name, falling back to the primary locale.
 *  Mirrors the database's i18n_text(). */
export function tr(value, lang) {
    if (!value) return ''
    if (typeof value === 'string') return value // tolerate un-migrated data
    const hit = value[lang]
    if (typeof hit === 'string' && hit.trim()) return hit.trim()
    const fallback = value[PRIMARY]
    return typeof fallback === 'string' ? fallback.trim() : ''
}

/** Locales with no translation yet. Mirrors the database's i18n_missing(). */
export function missingLocales(value) {
    if (!value || typeof value !== 'object') return LANGS.slice()
    return LANGS.filter((l) => !(typeof value[l] === 'string' && value[l].trim()))
}

/** True when this locale has its own translation rather than a fallback. */
export function hasLocale(value, lang) {
    return !!(
        value &&
        typeof value === 'object' &&
        typeof value[lang] === 'string' &&
        value[lang].trim()
    )
}

export const translations = {
    en: {
        label: 'English',
        subtitle: 'Pick a word, act it out, let them guess — your ready-made deck for game night.',
        stats: { total: 'keywords', categories: 'categories', easy: 'easy', medium: 'medium', hard: 'hard', issues: 'issues' },
        search: 'Search',
        searchPlaceholder: 'Search any language…',
        language: 'Language',
        category: 'Category',
        level: 'Level',
        cols: { keyword: 'Keyword', category: 'Category', level: 'Level' },
        levels: { Easy: 'Easy', Medium: 'Medium', Hard: 'Hard' },
        pagination: { page: 'Page', of: 'of', rows: 'rows', records: 'records' },
        exportLabel: 'Export {count} item',
        exportLabelPlural: 'Export {count} items',
        loading: 'Loading keywords…',
        noMatch: 'No keywords match the current filters.',
        errorPrefix: 'Could not load data:',
        issuesTooltip: 'Click to show only keywords with problems',
        noIssuesTooltip: 'No data issues found',
        reasons: { dup: 'Duplicate name', missing: 'Missing field' },
        game: {
            played: 'Played',
            nowPlaying: 'NOW PLAYING',
            done: 'Done — next',
            skip: 'Skip',
            play: 'Play',
            tagPlay: 'PLAY',
            tagSkip: 'SKIP',
            allPlayed: 'Every keyword played!',
            reset: 'Reset game',
            noneYet: 'No keywords played yet.',
            clearAll: 'Clear all / reset',
        },
        picker: {
            button: 'Random keyword', title: 'Pick a keyword', hint: 'Tap one of the 5 to select it, then confirm.',
            confirm: 'Confirm', reshuffle: 'Shuffle 5 new', cancel: 'Cancel',
            poolAll: 'from all keywords', poolFiltered: 'from current filter', playedTitle: 'Played keywords',
            clearAll: 'Clear all', remove: 'Remove',
            allPlayed: 'Every keyword in this pool has been played.',
        },
    },
    vi: {
        label: 'Tiếng Việt',
        subtitle: 'Chọn một từ, diễn tả, để cả nhóm cùng đoán — bộ từ sẵn sàng cho buổi chơi game.',
        stats: { total: 'từ khóa', categories: 'chủ đề', easy: 'dễ', medium: 'trung bình', hard: 'khó', issues: 'lỗi' },
        search: 'Tìm kiếm',
        searchPlaceholder: 'Tìm mọi ngôn ngữ…',
        language: 'Ngôn ngữ',
        category: 'Chủ đề',
        level: 'Cấp độ',
        cols: { keyword: 'Từ khóa', category: 'Chủ đề', level: 'Cấp độ' },
        levels: { Easy: 'Dễ', Medium: 'Trung bình', Hard: 'Khó' },
        pagination: { page: 'Trang', of: '/', rows: 'dòng', records: 'bản ghi' },
        exportLabel: 'Xuất {count} từ khóa',
        exportLabelPlural: 'Xuất {count} từ khóa',
        loading: 'Đang tải từ khóa…',
        noMatch: 'Không có từ khóa nào khớp với bộ lọc.',
        errorPrefix: 'Không tải được dữ liệu:',
        issuesTooltip: 'Nhấn để chỉ hiện các từ khóa có lỗi',
        noIssuesTooltip: 'Không phát hiện lỗi dữ liệu',
        reasons: { dup: 'Trùng tên', missing: 'Thiếu dữ liệu' },
        game: {
            played: 'Đã chơi',
            nowPlaying: 'ĐANG DIỄN',
            done: 'Xong, tiếp theo',
            skip: 'Bỏ qua',
            play: 'Chơi',
            tagPlay: 'CHƠI',
            tagSkip: 'BỎ QUA',
            allPlayed: 'Đã chơi hết từ khóa!',
            reset: 'Chơi lại',
            noneYet: 'Chưa có từ nào.',
            clearAll: 'Xóa tất cả / chơi lại',
        },
        picker: {
            button: 'Từ khóa ngẫu nhiên', title: 'Chọn một từ khóa', hint: 'Chạm vào 1 trong 5 từ để chọn, rồi xác nhận.',
            confirm: 'Xác nhận', reshuffle: 'Đổi 5 từ khác', cancel: 'Hủy',
            poolAll: 'từ toàn bộ từ khóa', poolFiltered: 'từ bộ lọc hiện tại', playedTitle: 'Từ khóa đã chơi',
            clearAll: 'Xóa tất cả', remove: 'Xóa',
            allPlayed: 'Tất cả từ khóa trong nhóm này đã được chơi.',
        },
    },
    ja: {
        label: '日本語',
        subtitle: '言葉を選んで、演じて、みんなに当ててもらおう — ゲームナイトのためのキーワード集。',
        stats: { total: 'キーワード', categories: 'カテゴリ', easy: 'やさしい', medium: 'ふつう', hard: 'むずかしい', issues: 'エラー' },
        search: '検索',
        searchPlaceholder: 'すべての言語から検索…',
        language: '言語',
        category: 'カテゴリ',
        level: 'レベル',
        cols: { keyword: 'キーワード', category: 'カテゴリ', level: 'レベル' },
        levels: { Easy: 'やさしい', Medium: 'ふつう', Hard: 'むずかしい' },
        pagination: { page: 'ページ', of: '/', rows: '行', records: '件' },
        exportLabel: '{count}件のキーワードをエクスポート',
        exportLabelPlural: '{count}件のキーワードをエクスポート',
        loading: 'キーワードを読み込み中…',
        noMatch: '条件に一致するキーワードがありません。',
        errorPrefix: 'データを読み込めませんでした:',
        issuesTooltip: '問題のあるキーワードのみ表示',
        noIssuesTooltip: '問題は見つかりませんでした',
        reasons: { dup: '名前の重複', missing: '項目が未入力' },
        game: {
            played: 'プレイ済み',
            nowPlaying: 'プレイ中',
            done: '完了 — 次へ',
            skip: 'スキップ',
            play: 'プレイ',
            tagPlay: 'プレイ',
            tagSkip: 'スキップ',
            allPlayed: 'すべてのキーワードをプレイしました！',
            reset: 'リセット',
            noneYet: 'まだプレイしたキーワードはありません。',
            clearAll: 'すべて削除 / リセット',
        },
        picker: {
            button: 'ランダムなキーワード', title: 'キーワードを選ぶ', hint: '5つから1つ選んで確定してください。',
            confirm: '確定', reshuffle: '別の5つ', cancel: 'キャンセル',
            poolAll: 'すべてのキーワードから', poolFiltered: '現在の絞り込みから', playedTitle: 'プレイしたキーワード',
            clearAll: 'すべて削除', remove: '削除',
            allPlayed: 'このグループのキーワードはすべてプレイ済みです。',
        },
    },
    zh: {
        label: '中文',
        subtitle: '选一个词，演出来，让大家猜 — 为游戏之夜准备好的词库。',
        stats: { total: '关键词', categories: '分类', easy: '简单', medium: '中等', hard: '困难', issues: '问题' },
        search: '搜索',
        searchPlaceholder: '搜索任意语言…',
        language: '语言',
        category: '分类',
        level: '难度',
        cols: { keyword: '关键词', category: '分类', level: '难度' },
        levels: { Easy: '简单', Medium: '中等', Hard: '困难' },
        pagination: { page: '第', of: '/', rows: '行', records: '条' },
        exportLabel: '导出 {count} 个关键词',
        exportLabelPlural: '导出 {count} 个关键词',
        loading: '正在加载关键词…',
        noMatch: '没有符合当前筛选的关键词。',
        errorPrefix: '无法加载数据:',
        issuesTooltip: '点击只显示有问题的关键词',
        noIssuesTooltip: '未发现数据问题',
        reasons: { dup: '名称重复', missing: '缺少内容' },
        game: {
            played: '已玩',
            nowPlaying: '正在进行',
            done: '完成 — 下一个',
            skip: '跳过',
            play: '玩',
            tagPlay: '玩',
            tagSkip: '跳过',
            allPlayed: '所有关键词都玩过了！',
            reset: '重新开始',
            noneYet: '还没有玩过任何关键词。',
            clearAll: '清除全部 / 重置',
        },
        picker: {
            button: '随机关键词', title: '选择一个关键词', hint: '点击 5 个中的 1 个，然后确认。',
            confirm: '确认', reshuffle: '换 5 个', cancel: '取消',
            poolAll: '来自全部关键词', poolFiltered: '来自当前筛选', playedTitle: '玩过的关键词',
            clearAll: '清除全部', remove: '删除',
            allPlayed: '该范围内的关键词都已玩过。',
        },
    },
    ko: {
        label: '한국어',
        subtitle: '단어를 골라 몸으로 표현하고 맞혀보세요 — 게임 나이트를 위한 키워드 덱.',
        stats: { total: '키워드', categories: '카테고리', easy: '쉬움', medium: '보통', hard: '어려움', issues: '오류' },
        search: '검색',
        searchPlaceholder: '모든 언어에서 검색…',
        language: '언어',
        category: '카테고리',
        level: '난이도',
        cols: { keyword: '키워드', category: '카테고리', level: '난이도' },
        levels: { Easy: '쉬움', Medium: '보통', Hard: '어려움' },
        pagination: { page: '페이지', of: '/', rows: '행', records: '개' },
        exportLabel: '{count}개 키워드 내보내기',
        exportLabelPlural: '{count}개 키워드 내보내기',
        loading: '키워드를 불러오는 중…',
        noMatch: '조건에 맞는 키워드가 없습니다.',
        errorPrefix: '데이터를 불러올 수 없습니다:',
        issuesTooltip: '문제가 있는 키워드만 보기',
        noIssuesTooltip: '데이터 문제가 없습니다',
        reasons: { dup: '이름 중복', missing: '누락된 항목' },
        game: {
            played: '플레이함',
            nowPlaying: '플레이 중',
            done: '완료 — 다음',
            skip: '건너뛰기',
            play: '플레이',
            tagPlay: '플레이',
            tagSkip: '건너뛰기',
            allPlayed: '모든 키워드를 플레이했습니다!',
            reset: '게임 초기화',
            noneYet: '아직 플레이한 키워드가 없습니다.',
            clearAll: '전체 삭제 / 초기화',
        },
        picker: {
            button: '랜덤 키워드', title: '키워드 선택', hint: '5개 중 1개를 눌러 선택한 뒤 확인하세요.',
            confirm: '확인', reshuffle: '다른 5개', cancel: '취소',
            poolAll: '전체 키워드에서', poolFiltered: '현재 필터에서', playedTitle: '플레이한 키워드',
            clearAll: '전체 삭제', remove: '삭제',
            allPlayed: '이 범위의 키워드를 모두 플레이했습니다.',
        },
    },
}
