// === CẤU HÌNH TỐC ĐỘ CAO ===
const FIREBASE_URL = "https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/sensorData.json";
const GEMINI_API_KEY = "AIzaSyDdUj2SX83qODeZ1hhru0e9KN1fwDrtUP8";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

// Bảng chuyển đổi Tiếng Việt (tách riêng để dễ quản lý)
// Bảng đầy đủ được định nghĩa trong vietnamese-table.js

// Ánh xạ trạng thái MPU
const mpuStateMap = {
    "Up": 0,
    "Down": 1,
    "Left": 2,
    "Right": 3,
    "Forward": 4,
    "Backward": 5
};

// Đề xuất cụm từ
const commonPhrases = [
    "Xin chào, rất vui được gặp bạn",
    "Bạn khỏe không?",
    "Cảm ơn bạn rất nhiều",
    "Làm ơn cho tôi hỏi đường",
    "Chúc một ngày tốt lành",
    "Tôi yêu ngôn ngữ này",
    "Hẹn gặp lại sau",
    "Tôi đói bụng",
    "Bao nhiêu tiền?",
    "Tôi không hiểu"
];

// Constants
const DEBOUNCE_COUNT = 3;
const HOLD_MS_DEFAULT = 800;
const POST_HOLD_COOLDOWN = 600;
const MAX_LOG_ENTRIES = 20;
const TRANSLATION_COOLDOWN = 2000;

// Threshold cố định cho thẳng
const STRAIGHT_THRESHOLDS = [150, 150, 150, 100];
