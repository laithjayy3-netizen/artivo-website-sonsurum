const HF_API_BASE =
  "https://stabilityai-stable-fast-3d.hf.space/gradio_api";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Only GET requests are allowed."
    });
  }

  try {
    const response = await fetch(
      `${HF_API_BASE}/openapi.json`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        status: response.status,
        error: text.slice(0, 1000)
      });
    }

    let schema;

    try {
      schema = JSON.parse(text);
    } catch (_) {
      return res.status(502).json({
        success: false,
        error: "Hugging Face returned non-JSON data."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stable Fast 3D API is reachable.",
      space: "stabilityai/stable-fast-3d",
      hasOpenAPI: !!schema,
      endpoints: Object.keys(schema.paths || {})
    });

  } catch (error) {
    console.error(
      "ARTIVO Image-to-3D schema test error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Could not reach Hugging Face."
    });
  }
}
