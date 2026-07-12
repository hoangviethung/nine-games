// Fixed UI copy for the two supported languages.
// The keyword DATA itself is bilingual in the database (name / vietnamese);
// this file only covers the static interface chrome.

export const LANGS = ["en", "vi"];

export const translations = {
    en: {
        label: "English",
        subtitle: "Charades & guessing keywords · live from Supabase",
        stats: {
            total: "total keywords",
            categories: "categories",
            easy: "easy",
            medium: "medium",
            hard: "hard",
            issues: "issues",
        },
        search: "Search",
        searchPlaceholder: "Search English / Tiếng Việt…",
        language: "Language",
        category: "Category",
        level: "Level",
        cols: {
            keyword: "Keyword",
            category: "Category",
            level: "Level",
        },
        levels: { Easy: "Easy", Medium: "Medium", Hard: "Hard" },
        pagination: {
            page: "Page",
            of: "of",
            rows: "rows",
            records: "records",
        },
        loading: "Loading keywords…",
        noMatch: "No keywords match the current filters.",
        errorPrefix: "Could not load data:",
        issuesTooltip: "Click to show only keywords with problems",
        noIssuesTooltip: "No data issues found",
        reasons: {
            dupEn: "Duplicate English",
            dupVi: "Duplicate Vietnamese",
            missing: "Missing field",
        },
    },
    vi: {
        label: "Tiếng Việt",
        subtitle: "Từ khóa đố chữ & đoán từ · trực tiếp từ Supabase",
        stats: {
            total: "tổng từ khóa",
            categories: "chủ đề",
            easy: "dễ",
            medium: "trung bình",
            hard: "khó",
            issues: "lỗi",
        },
        search: "Tìm kiếm",
        searchPlaceholder: "Tìm tiếng Anh / Tiếng Việt…",
        language: "Ngôn ngữ",
        category: "Chủ đề",
        level: "Cấp độ",
        cols: {
            keyword: "Từ khóa",
            category: "Chủ đề",
            level: "Cấp độ",
        },
        levels: { Easy: "Dễ", Medium: "Trung bình", Hard: "Khó" },
        pagination: {
            page: "Trang",
            of: "/",
            rows: "dòng",
            records: "bản ghi",
        },
        loading: "Đang tải từ khóa…",
        noMatch: "Không có từ khóa nào khớp với bộ lọc.",
        errorPrefix: "Không tải được dữ liệu:",
        issuesTooltip: "Nhấn để chỉ hiện các từ khóa có lỗi",
        noIssuesTooltip: "Không phát hiện lỗi dữ liệu",
        reasons: {
            dupEn: "Trùng tiếng Anh",
            dupVi: "Trùng tiếng Việt",
            missing: "Thiếu dữ liệu",
        },
    },
};
