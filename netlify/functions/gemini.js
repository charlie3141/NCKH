export default async (req) => {
  try {
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      return new Response("Missing API key", { status: 500 });
    }

    const body = await req.json();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + key,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(err.toString(), { status: 500 });
  }
};
