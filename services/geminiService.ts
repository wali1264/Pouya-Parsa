// This function now calls our own backend proxy, not Gemini directly.
export const identifyProductsFromImage = async (base64Image: string): Promise<{name: string}[]> => {
  console.log("Sending image to our API proxy for analysis...");

  try {
    const response = await fetch('/api/recognize-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
        const errorMessage = `خطا در سرور پراکسی: ${errorData.message || response.statusText}`;
        console.error("API proxy returned an error:", errorMessage);
        throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("Error calling API proxy:", error);
    // Re-throw the error so the UI components can catch it and display a proper message
    // instead of falling back to mock data.
    throw error;
  }
};
