const axios = require("axios");
const fs = require("fs");

const generateStream = async (userPrompt) => {
  //const prompt = "Answer very profesionell and short to this prompt: " + userPrompt;
  const prompt = '"""System"""Answer to this in a profesionell way"""END SYSTEM """: ' + userPrompt;
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

        const writeStream = fs.createWriteStream("ai/answer.md");

        // Stream processing
        response.data.on("data", (chunk) => {
            try {
                const chunkData = JSON.parse(chunk.toString());
                if (chunkData.response) {
                    process.stdout.write(chunkData.response);
                    writeStream.write(chunkData.response);
                }
            } catch (error) {
                console.error("Error parsing chunk:", error);
            }
        });

        response.data.on("end", () => {
            console.log("\nStream complete.");
            writeStream.end();
        });
    } catch (error) {
        console.error("Error generating stream:", error);
    }
};

generateStream("Why did the chicken cross the road?");