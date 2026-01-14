const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function(event, context) {
  // Chỉ cho phép POST
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: "Method not allowed" }) 
    };
  }

  try {
    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key not configured" })
      };
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const requestBody = JSON.parse(event.body);
    const { action, text, sourceLang, targetLang, voiceName, lang } = requestBody;

    // Xử lý dịch thuật
    if (action === "translate") {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Translate from ${sourceLang} to ${targetLang}. Maintain natural and formal tone. Output ONLY the translated text, no quotes, no extra notes. Text: "${text}"`;
      
      const result = await model.generateContent(prompt);
      const translated = result.response.text().trim();
      
      return {
        statusCode: 200,
        body: JSON.stringify({ translatedText: translated })
      };
    }
    
    // Xử lý TTS
    else if (action === "tts") {
      // Gemini TTS (nếu có) - cần kiểm tra model hỗ trợ
      // Ở đây tạm thời trả về lỗi vì Gemini chưa hỗ trợ TTS trực tiếp
      return {
        statusCode: 501,
        body: JSON.stringify({ 
          error: "TTS not implemented yet",
          message: "Please use Web Speech API instead"
        })
      };
    }
    
    else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid action" })
      };
    }

  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || "Internal server error" 
      })
    };
  }
};
