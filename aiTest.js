const axios = require("axios");

const generateStream = async (userPrompt) => {
    const prompt = "Answer very profesionell and short to this prompt: " + userPrompt
  try {
    const response = await axios.post(
      "http://127.0.0.1:11434/api/generate",
      {
        model: "mistral",
        prompt: prompt,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "stream", 
      }
    );

    // Stream processing
    response.data.on("data", (chunk) => {
      try {
        const chunkData = JSON.parse(chunk.toString()); 
        if (chunkData.response) {
          process.stdout.write(chunkData.response); 
        }
      } catch (error) {
        console.error("Error parsing chunk:", error);
      }
    });

    response.data.on("end", () => {
      console.log("\nStream complete."); 
    });
  } catch (error) {
    console.error("Error:", error.message);
  }
};

generateStream("Hey, show me a expressJS webserver code please");
