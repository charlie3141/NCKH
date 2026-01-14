// netlify/functions/get-data.js

exports.handler = async (event, context) => {
  // Trong Node.js (Netlify Functions), bạn truy cập trực tiếp qua process.env
  // Không cần tiền tố VITE_ (nhưng nếu bạn đã đặt VITE_ trên Dashboard thì vẫn dùng được)
  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  const FIREBASE_URL = process.env.VITE_FIREBASE_URL;

  // Kiểm tra nếu thiếu cấu hình
  if (!GEMINI_API_KEY || !FIREBASE_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Chưa cấu hình biến môi trường trên Netlify" }),
    };
  }

  try {
    // Ví dụ: Gọi đến Firebase lấy dữ liệu sensor
    const response = await fetch(FIREBASE_URL);
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        message: "Kết nối thành công", 
        sensorData: data,
        // Lưu ý: Không bao giờ trả ngược GEMINI_API_KEY về cho client ở đây
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
