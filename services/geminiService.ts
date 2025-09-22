import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleItem, ItemType } from '../types';

if (!process.env.API_KEY) {
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const scheduleParserModel = 'gemini-2.5-flash';
const contentFetcherModel = 'gemini-2.5-flash';

export const parseSchedule = async (scheduleContent: { type: 'image' | 'text', data: string, mimeType?: string }): Promise<ScheduleItem[]> => {
  const sourceDescription = scheduleContent.type === 'image'
    ? 'Analyze the provided image of a church service schedule.'
    : 'Analyze the provided text content of a church service schedule.';

  const prompt = `
    You are an intelligent assistant for church service planning. ${sourceDescription} Your task is to extract all distinct items from the schedule in the order they appear and classify them.

    The categories are: 'song', 'scripture', and 'event'.
    - 'song': Any item that is a song title, hymn, or 'Gemeindelied'. Examples: "Mein Retter, Erlöser", "Größer", "Höher", "Gemeindelied: Ja, heute feiern wir, Q. 23", "Bewahre uns Gott, EG 171, 1-4". Extract the full title including hymn numbers like 'EG 171'.
    - 'scripture': Any item that is a bible passage. Example: "Psalm 23 Basisbibel". Extract just the reference, "Psalm 23".
    - 'event': Any other item in the schedule. Examples: "Musikalisches Vorspiel", "Begrüßung und Votum", "Predigt", "Segen".

    Return your response as a single, valid JSON array of objects. Each object should have two properties: "type" (string: 'song', 'scripture', or 'event') and "title" (string: the extracted title or reference).

    Do not include any introductory text, code block markers, or explanations outside of the JSON array. Your entire response should be the raw JSON array.
    `;
    
  let requestContents: any;
  if (scheduleContent.type === 'image' && scheduleContent.mimeType) {
    requestContents = {
      parts: [
        { inlineData: { mimeType: scheduleContent.mimeType, data: scheduleContent.data } },
        { text: prompt },
      ]
    };
  } else {
    requestContents = `${prompt}\n\nHere is the schedule text:\n\n${scheduleContent.data}`;
  }


  try {
    const response = await ai.models.generateContent({
      model: scheduleParserModel,
      contents: requestContents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['song', 'scripture', 'event'] },
              title: { type: Type.STRING }
            },
            required: ['type', 'title']
          }
        }
      }
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    return parsedJson as ScheduleItem[];
  } catch (error) {
    console.error("Error parsing schedule:", error);
    throw new Error("Analyse des Plans fehlgeschlagen. Das KI-Modell konnte die Datei möglicherweise nicht verarbeiten.");
  }
};

export const getSongLyrics = async (title: string): Promise<string> => {
    const prompt = `
    You are an expert assistant specializing in Christian hymnology and worship music. Your task is to provide accurate and well-formatted lyrics for presentation software.
    
    Please provide the full and accurate lyrics for the Christian worship song titled "${title}".
    
    Instructions:
    1.  **Source:** Prioritize accuracy. Use your knowledge from reliable sources (like official artist websites, CCLI, hymnaries, or major lyrics databases) to find the lyrics. If the title includes a hymn number (e.g., EG 171), that specific version is required.
    2.  **Formatting:** Format the lyrics for presentation slides. Separate verses, choruses, bridges, and other distinct sections with a line containing only '---'. This is crucial for splitting the text into slides.
    3.  **Content:** Include ONLY the lyrics. Do not add metadata like "Verse 1", "Chorus", author names, or chord notations.
    4.  **Failure:** If, after a thorough search, you cannot find the definitive lyrics, return ONLY the string "Liedtext für '${title}' nicht gefunden.".
    
    Example of correct formatting:
    Amazing grace how sweet the sound
    That saved a wretch like me
    I once was lost, but now I'm found
    Was blind but now I see
    
    ---
    
    'Twas grace that taught my heart to fear
    And grace my fears relieved
    How precious did that grace appear
    The hour I first believed
    `;

  try {
    const response = await ai.models.generateContent({
      model: contentFetcherModel,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error(`Error fetching lyrics for "${title}":`, error);
    return `Fehler beim Abrufen des Liedtextes für '${title}'.`;
  }
};

export const getScriptureText = async (reference: string, translation: string): Promise<string> => {
  const prompt = `
    Please provide the full text for the scripture passage "${reference}" from the "${translation}" Bible translation.
    - Format the text for presentation on screen.
    - Place each verse number at the beginning of its verse on the same line, followed by the text. (e.g., "1 Der HERR ist mein Hirte...")
    - Group verses into small, readable chunks for slides. Separate these chunks with a line containing only '---' (e.g., Verses 1-2...\\n\\n---\\n\\nVerses 3-4...).
    - Do not include any introductory text, titles, or explanations. Just the scripture text.
    - If you cannot find the passage in the specified translation, return the string "Schrifttext für '${reference} (${translation})' nicht gefunden.".
    `;
    
  try {
    const response = await ai.models.generateContent({
      model: contentFetcherModel,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error(`Error fetching scripture for "${reference}":`, error);
    return `Fehler beim Abrufen des Schrifttextes für '${reference}'.`;
  }
};