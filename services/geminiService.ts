import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleItem, ItemType } from '../types';

if (!process.env.API_KEY) {
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const scheduleParserModel = 'gemini-2.5-flash';
const contentFetcherModel = 'gemini-2.5-flash';

export const parseSchedule = async (imageData: string, mimeType: string): Promise<ScheduleItem[]> => {
  const prompt = `
    You are an intelligent assistant for church service planning. Analyze the provided image of a church service schedule. Your task is to extract all distinct items from the schedule in the order they appear and classify them.

    The categories are: 'song', 'scripture', and 'event'.
    - 'song': Any item that is a song title, hymn, or 'Gemeindelied'. Examples: "Mein Retter, Erlöser", "Größer", "Höher", "Gemeindelied: Ja, heute feiern wir, Q. 23", "Bewahre uns Gott, EG 171, 1-4". Extract the full title including hymn numbers like 'EG 171'.
    - 'scripture': Any item that is a bible passage. Example: "Psalm 23 Basisbibel". Extract just the reference, "Psalm 23".
    - 'event': Any other item in the schedule. Examples: "Musikalisches Vorspiel", "Begrüßung und Votum", "Predigt", "Segen".

    Return your response as a single, valid JSON array of objects. Each object should have two properties: "type" (string: 'song', 'scripture', or 'event') and "title" (string: the extracted title or reference).

    Do not include any introductory text, code block markers, or explanations outside of the JSON array. Your entire response should be the raw JSON array.
    `;

  try {
    const response = await ai.models.generateContent({
      model: scheduleParserModel,
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageData } },
          { text: prompt },
        ]
      },
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
    throw new Error("Analyse des Plans fehlgeschlagen. Das KI-Modell konnte das Bild möglicherweise nicht verarbeiten.");
  }
};

export const getSongLyrics = async (title: string): Promise<string> => {
  const prompt = `
    Please provide the full lyrics for the Christian worship song titled "${title}".
    - If the title includes a hymn number (like EG or Q.), prioritize finding that specific version.
    - Format the lyrics for presentation on screen.
    - Separate verses, choruses, and bridges with a line containing only '---' to create distinct slides (e.g., Verse 1...\\n\\n---\\n\\nChorus...).
    - Do not include chord notations or author credits, only the lyrics.
    - If you cannot find the lyrics, return the string "Liedtext für '${title}' nicht gefunden.".
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