// Node.js 伺服器函式，用於 Vercel/Netlify 等平台
// 這個函式會接收前端的請求，然後安全地呼叫 Gemini API

export default async function handler(request, response) {
    // 只接受 POST 請求
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 從前端傳來的請求中讀取 "topic"
        const { topic } = request.body;
        if (!topic) {
            return response.status(400).json({ error: '主題為必填項' });
        }

        // 從伺服器環境變數中安全地讀取 API 金鑰
        // 這是最重要的一步，金鑰不會暴露在前端
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            // 如果在 Vercel 上忘記設定環境變數，就會觸發這個錯誤
            console.error('錯誤：找不到 GEMINI_API_KEY 環境變數');
            return response.status(500).json({ error: 'API 金鑰未在伺服器上設定' });
        }
        
        const modelName = "gemini-2.5-flash-preview-05-20";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        // 與您原本前端相同的 AI 指令 (System Prompt)
        const systemPrompt = "你是一位市場調查員和廣告專業的廣告投售。你的任務是根據用戶提供的產品或課程主題，生成一個包含10個行為的列表，以及每個行為底下8到10個精準的感興趣受眾。最重要的一點是：**每個感興趣受眾的描述後方，請務必使用括號 `(...)` 標示一個最相關的廣告平台可選取的受眾標籤（例如：興趣標籤或行為標籤），並緊接著使用方括號 `[...]` 標示該受眾規模的預估人數範圍。請以中文數字單位 (萬, 百萬) 呈現，例如：[人數範圍: 20萬 - 150萬]**。請以繁體中文回應，並嚴格遵循提供的JSON結構和數量要求。請確保受眾描述具體、專業且符合市場行銷的邏輯。";
        const userQuery = `請針對主題：「${topic}」，生成10個行為及每個行為下8-10個精準受眾。`;

        // 構造發送給 Gemini API 的 payload
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "behavior": { "type": "STRING", "description": "與產品主題相關的具體用戶行為" },
                            "audiences": {
                                "type": "ARRAY",
                                "items": { "type": "STRING", "description": "對此行為感興趣的8-10個精準受眾輪廓，必須包含標籤和規模" }
                            }
                        },
                        required: ["behavior", "audiences"]
                    }
                }
            }
        };

        // 呼叫 Gemini API
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        // 如果 Gemini API 回應不成功，則拋出錯誤
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API 錯誤:", errorText);
            throw new Error(`Gemini API 請求失敗，狀態碼: ${geminiResponse.status}`);
        }

        const data = await geminiResponse.json();
        
        // 將從 Gemini API 獲得的結果回傳給前端
        response.status(200).json(data);

    } catch (error) {
        console.error('後端代理發生錯誤:', error);
        response.status(500).json({ error: '後端伺服器發生內部錯誤', details: error.message });
    }
}

