// ARTIVO Image-to-3D API
// Stage 2: connects the ARTİVO frontend to the public
// Stable Fast 3D Hugging Face Space.
//
// Environment variable:
//   HF_TOKEN = optional Hugging Face access token.
//              A free token is recommended for better ZeroGPU
//              quota/rate handling, but the code can try anonymously.

const HF_SPACE_URL = "https://stabilityai-stable-fast-3d.hf.space";
const HF_API_BASE = `${HF_SPACE_URL}/gradio_api`;
const HF_TOKEN = process.env.HF_TOKEN || "";

function authHeaders(extra = {}) {
  const headers = { ...extra };

  if (HF_TOKEN) {
    headers.Authorization = `Bearer ${HF_TOKEN}`;
  }

  return headers;
}

function fileData(path, originalName) {
  return {
    path,
    meta: { _type: "gradio.FileData" },
    orig_name: originalName || "artivo-input.png"
  };
}

async function readSSE(response, label) {
  if (!response.ok) {
    const text = await response.text().catch(() => "");

    throw new Error(
      `${label} failed (${response.status})${
        text ? `: ${text.slice(0, 500)}` : ""
      }`
    );
  }

  if (!response.body) {
    throw new Error(`${label} returned no streaming body.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const eventMatch = block.match(/^event:\s*(.+)$/m);
      const dataMatch = block.match(/^data:\s*(.+)$/m);

      if (!eventMatch) {
        continue;
      }

      const eventName = eventMatch[1].trim();
      const rawData = dataMatch ? dataMatch[1].trim() : "";

      if (eventName === "error") {
        let detail = rawData;

        try {
          detail = JSON.parse(rawData);
        } catch (_) {}

        throw new Error(
          `${label} returned an error${
            detail
              ? `: ${
                  typeof detail === "string"
                    ? detail
                    : JSON.stringify(detail)
                }`
              : "."
          }`
        );
      }

      if (eventName === "complete") {
        try {
          return rawData ? JSON.parse(rawData) : null;
        } catch (_) {
          throw new Error(
            `${label} returned invalid completion data.`
          );
        }
      }
    }
  }

  throw new Error(
    `${label} ended before a complete result was received.`
  );
}

async function startGradioJob(apiName, data) {
  const response = await fetch(
    `${HF_API_BASE}/call/${apiName}`,
    {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        data
      })
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");

    throw new Error(
      `Hugging Face job could not be started (${response.status})${
        text ? `: ${text.slice(0, 600)}` : ""
      }`
    );
  }

  const payload = await response.json();

  if (!payload?.event_id) {
    throw new Error(
      "Hugging Face did not return an event ID."
    );
  }

  const resultResponse = await fetch(
    `${HF_API_BASE}/call/${apiName}/${encodeURIComponent(
      payload.event_id
    )}`,
    {
      method: "GET",
      headers: authHeaders({
        Accept: "text/event-stream"
      })
    }
  );

  return readSSE(
    resultResponse,
    `Hugging Face ${apiName}`
  );
}

async function uploadToHuggingFace(
  buffer,
  mimeType,
  originalName
) {
  const form = new FormData();

  form.append(
    "files",
    new Blob(
      [buffer],
      {
        type: mimeType || "image/png"
      }
    ),
    originalName || "artivo-input.png"
  );

  const response = await fetch(
    `${HF_API_BASE}/upload`,
    {
      method: "POST",
      headers: authHeaders(),
      body: form
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");

    throw new Error(
      `Image upload failed (${response.status})${
        text ? `: ${text.slice(0, 600)}` : ""
      }`
    );
  }

  const payload = await response.json();

  if (
    !Array.isArray(payload) ||
    !payload[0]
  ) {
    throw new Error(
      "Hugging Face returned an invalid upload response."
    );
  }

  return payload[0];
}

function getSelectedValue(
  value,
  allowed,
  fallback
) {
  return allowed.includes(value)
    ? value
    : fallback;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Only POST requests are allowed."
    });
  }

  try {
    const body = req.body || {};

    const imageBase64 = body.image;
    const mimeType =
      body.mimeType || "image/png";
    const originalName =
      body.fileName || "artivo-input.png";

    if (
      typeof imageBase64 !== "string" ||
      !imageBase64.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Image data is required."
      });
    }

    const cleanBase64 = imageBase64
      .replace(
        /^data:[^;]+;base64,/,
        ""
      )
      .trim();

    let buffer;

    try {
      buffer = Buffer.from(
        cleanBase64,
        "base64"
      );
    } catch (_) {
      return res.status(400).json({
        success: false,
        error: "Invalid image data."
      });
    }

    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        error: "The uploaded image is empty."
      });
    }

    // Experimental upload limit: 8 MB.
    if (
      buffer.length >
      8 * 1024 * 1024
    ) {
      return res.status(413).json({
        success: false,
        error:
          "For the experimental version, please use an image smaller than 8 MB."
      });
    }

    const format = getSelectedValue(
      body.format,
      ["GLB", "OBJ"],
      "GLB"
    );

    const quality = getSelectedValue(
      body.quality,
      ["Standard", "High"],
      "Standard"
    );

    const texture = getSelectedValue(
      body.texture,
      ["On", "Off"],
      "On"
    );

    // Stable Fast 3D generates GLB directly.
    // OBJ export will be added later.
    if (format !== "GLB") {
      return res.status(400).json({
        success: false,
        error:
          "The experimental engine currently generates GLB. OBJ export will be added later."
      });
    }

    const textureSize =
      texture === "Off"
        ? 512
        : quality === "High"
          ? 2048
          : 1024;

    const remeshOption =
      quality === "High"
        ? "Triangle"
        : "None";

    const vertexCount = -1;

    /*
      1. Upload source image
    */

    const uploadedPath =
      await uploadToHuggingFace(
        buffer,
        mimeType,
        originalName
      );

    const inputFile = fileData(
      uploadedPath,
      originalName
    );

    /*
      2. Prepare foreground
    */

    const backgroundResults =
      await startGradioJob(
        "run_button",
        [
          "Remove Background",
          inputFile,
          null,
          0.85,
          remeshOption,
          vertexCount,
          textureSize
        ]
      );

    if (
      !Array.isArray(backgroundResults) ||
      !backgroundResults[2]
    ) {
      throw new Error(
        "Stable Fast 3D did not return a prepared foreground image."
      );
    }

    const preparedForeground =
      backgroundResults[2];

    /*
      3. Generate GLB
    */

    const generationResults =
      await startGradioJob(
        "run_button",
        [
          "Run",
          inputFile,
          preparedForeground,
          0.85,
          remeshOption,
          vertexCount,
          textureSize
        ]
      );

    if (
      !Array.isArray(generationResults) ||
      !generationResults[4]
    ) {
      throw new Error(
        "Stable Fast 3D did not return a GLB model."
      );
    }

    const modelFile =
      generationResults[4];

    const modelUrl =
      typeof modelFile === "string"
        ? modelFile
        : modelFile?.url || null;

    return res.status(200).json({
      success: true,
      format: "GLB",
      quality,
      texture,
      textureSize,
      model: modelFile,
      modelUrl,
      message:
        "3D model generated successfully."
    });

  } catch (error) {
    console.error(
      "ARTIVO Image-to-3D error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Image-to-3D generation failed."
    });
  }
}
