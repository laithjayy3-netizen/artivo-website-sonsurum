const HF_BASE =
  "https://stabilityai-stable-fast-3d.hf.space/gradio_api";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Only GET requests are allowed."
    });
  }

  try {
    // --------------------------------------------------
    // 1) Get the current API schema
    // --------------------------------------------------

    const infoResponse = await fetch(
      `${HF_BASE}/info`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    const infoText = await infoResponse.text();

    if (!infoResponse.ok) {
      return res.status(502).json({
        success: false,
        step: "info",
        status: infoResponse.status,
        error: infoText.slice(0, 1500)
      });
    }

    let info;

    try {
      info = JSON.parse(infoText);
    } catch (_) {
      return res.status(502).json({
        success: false,
        step: "info",
        error: "Hugging Face /info did not return valid JSON.",
        raw: infoText.slice(0, 1500)
      });
    }

    // --------------------------------------------------
    // 2) Get the Gradio config
    // --------------------------------------------------

    const configResponse = await fetch(
      `${HF_BASE.replace("/gradio_api", "")}/config`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    const configText =
      await configResponse.text();

    if (!configResponse.ok) {
      return res.status(502).json({
        success: false,
        step: "config",
        status: configResponse.status,
        error: configText.slice(0, 1500)
      });
    }

    let config;

    try {
      config = JSON.parse(configText);
    } catch (_) {
      return res.status(502).json({
        success: false,
        step: "config",
        error: "Hugging Face /config did not return valid JSON.",
        raw: configText.slice(0, 1500)
      });
    }

    // --------------------------------------------------
    // 3) Extract API information
    // --------------------------------------------------

    const apiInfo = info?.named_endpoints || {};
    const apiNames = Object.keys(apiInfo);

    // Gradio dependencies contain numeric IDs.
    const dependencies =
      Array.isArray(config?.dependencies)
        ? config.dependencies
        : [];

    const matchedEndpoints =
      dependencies
        .map((dependency) => ({
          id: dependency?.id,
          api_name: dependency?.api_name || null,
          inputs: dependency?.inputs || [],
          outputs: dependency?.outputs || []
        }))
        .filter((item) => item.api_name);

    // --------------------------------------------------
    // 4) Return only useful information
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Stable Fast 3D API schema retrieved successfully.",

      space:
        "stabilityai/stable-fast-3d",

      api_names:
        apiNames,

      endpoints:
        matchedEndpoints

    });

  } catch (error) {

    console.error(
      "ARTIVO Stable Fast 3D schema test error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Could not inspect Stable Fast 3D API."
    });
  }
}
