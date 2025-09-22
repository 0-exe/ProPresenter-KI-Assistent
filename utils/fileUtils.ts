import { PlaylistItem, ItemType } from '../types';

// Declaration for JSZip library loaded from CDN
declare var JSZip: any;
declare var mammoth: any;

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove "data:*/*;base64," part
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const extractTextFromFile = async (file: File): Promise<string> => {
  if (file.type === 'text/plain') {
    return file.text();
  }

  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) {
          return reject(new Error("Fehler beim Lesen der DOCX-Datei."));
        }
        try {
          const arrayBuffer = event.target.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  throw new Error("Nicht unterstützter Dateityp für die Textextraktion.");
};

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
};

const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const toBase64 = (str: string): string => {
  try {
    // This is a common method to Base64 encode UTF-8 strings in the browser.
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    console.error("Base64 encoding error:", e);
    return btoa("Encoding Error");
  }
};

const generateRtf = (text: string, fontSize: number = 120): string => {
  // A simple, reliable RTF generator to avoid ProPresenter import errors.
  const rtfEscapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\par\n');

  // Standard RTF document structure. Arial is a safe font choice.
  // \pard resets paragraph formatting, \qc centers text.
  const rtf = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}
{\\colortbl;\\red255\\green255\\blue255;}
\\pard\\qc
\\f0\\b\\fs${fontSize * 2} \\cf1 ${rtfEscapedText}
}`;
  return rtf;
};


const createPro7SlideXml = (text: string, isTitle: boolean): { uuid: string, xml: string } => {
  const slideUUID = generateUUID();
  const textUUID = generateUUID();
  const rtfData = generateRtf(text, isTitle ? 140 : 120);
  const base64RtfData = toBase64(rtfData);
  const escapedLabel = escapeXml(text.split('\n')[0].substring(0, 20));
  const escapedPlainText = escapeXml(text);
  
  const slideXml = `
    <RVDisplaySlide
      backgroundColor="0 0 0 1"
      enabled="1"
      highlightColor="0 0 0 0"
      hotKey=""
      label="${escapedLabel}"
      notes=""
      slideType="1"
      sort_index="0"
      UUID="${slideUUID}">
      <cues></cues>
      <displayElements>
        <RVTextElement
          displayName="Default"
          UUID="${textUUID}"
          fromTemplate="1"
          persistent="1"
          typeID="0"
          displayDelay="0"
          locked="0"
          opacity="1"
          source=""
          verticalAlignment="1"
          adjustsHeightToFit="0"
          revealType="0"
          fillColor="0 0 0 0"
          strokeColor="0 0 0 1"
          strokeWidth="0"
          drawingFill="0"
          drawingStroke="0"
          shadowColor="0 0 0 1"
          shadowBlur="0"
          shadowOffset="0 0">
          <position x="96" y="54" width="1728" height="972" z="0"/>
          <effects/>
          <RVFormattedText>
            <NSString name="RTFData">${base64RtfData}</NSString>
            <NSString name="PlainText">${escapedPlainText}</NSString>
          </RVFormattedText>
        </RVTextElement>
      </displayElements>
    </RVDisplaySlide>`;

    return { uuid: slideUUID, xml: slideXml };
};

const generateSinglePro7PresentationXml = (item: PlaylistItem, translation: string): string => {
  const presentationUUID = generateUUID();
  const date = new Date();
  const lastDateUsed = date.toISOString().slice(0, 19);

  const groupName = item.type === ItemType.SCRIPTURE ? `${item.title} (${translation})` : item.title;
  const escapedGroupName = escapeXml(groupName);
  
  // 1. Title slide
  const titleSlide = createPro7SlideXml(groupName, true);
  let allSlidesXml = titleSlide.xml;
  const slideUUIDs = [titleSlide.uuid];

  // 2. Content slides
  if (item.content) {
    const contentSlides = item.content.split('---').map(s => s.trim()).filter(s => s);
    contentSlides.forEach(slideText => {
      const contentSlide = createPro7SlideXml(slideText, false);
      allSlidesXml += contentSlide.xml;
      slideUUIDs.push(contentSlide.uuid);
    });
  }
  
  const groupUUID = generateUUID();
  const groupColor = item.type === ItemType.SONG ? "0 0 1 1" : "1 0.75 0 1";
  const groupsXml = `
    <RVSlideGrouping name="${escapedGroupName}" color="${groupColor}" uuid="${groupUUID}">
      <array name="slides">
        ${slideUUIDs.map(uuid => `<NSString>${uuid}</NSString>`).join('\n        ')}
      </array>
    </RVSlideGrouping>
  `;
  const escapedSongTitle = escapeXml(item.type === ItemType.SONG ? item.title : '');

  const fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<RVPresentationDocument
  backgroundColor="0 0 0 1"
  height="1080"
  width="1920"
  versionNumber="7100"
  docType="0"
  creatorCode="1349676881"
  lastDateUsed="${lastDateUsed}"
  usedCount="0"
  category="Default"
  resourcesDirectory=""
  notes=""
  os="2"
  buildNumber="118321027"
  UUID="${presentationUUID}"
  drawingBackgroundColor="0 0 0 0"
  CCLIDisplay="0"
  CCLIsongTitle="${escapedSongTitle}"
  CCLIPublisher=""
  CCLICopyrightYear=""
  CCLIAuthor=""
  CCLISongNumber="">
  
  <timeline timeOffSet="0" selectedMediaTrackIndex="0" loop="0" duration="0" unitOfMeasure="30"/>
  <bibleReference location="1001001" name="NIV"/>
  
  <array name="slides">${allSlidesXml}</array>
  <array name="groups">${groupsXml}</array>
</RVPresentationDocument>`;

  return fileContent.trim();
};

export const generateProPresenterPlaylist = async (playlist: PlaylistItem[], translation: string): Promise<void> => {
    const zip = new JSZip();
    const playlistItemsXml: string[] = [];
    let presentationIndex = 0;
    
    for (const item of playlist) {
      if (item.type === ItemType.EVENT) {
          const escapedDisplayName = escapeXml(item.title);
          const headerItemXml = `
            <RVPlaylistItem type="RVPlaylistItemTypeHeader" UUID="${generateUUID()}" displayName="${escapedDisplayName}">
            </RVPlaylistItem>`;
          playlistItemsXml.push(headerItemXml);
      } else {
          presentationIndex++;
          const presentationName = item.type === ItemType.SCRIPTURE ? `${item.title} (${translation})` : item.title;
          const sanitizedTitle = presentationName.replace(/[/\\?%*:|"<>]/g, '-');
          const fileName = `${presentationIndex.toString().padStart(2, '0')} - ${sanitizedTitle}.pro`;
          
          const presentationXml = generateSinglePro7PresentationXml(item, translation);
          zip.file(fileName, presentationXml);
          
          const escapedDisplayName = escapeXml(presentationName);
          const playlistItemXml = `
            <RVPlaylistItem 
                type="RVPlaylistItemTypePresentation" 
                slideShowDuration="0" 
                slideShowTransitionDuration="1" 
                slideShowTransition="RVSlideTransitionRandom" 
                UUID="${generateUUID()}" 
                displayName="${escapedDisplayName}">
                <NSString name="filePath">./${fileName}</NSString>
            </RVPlaylistItem>`;
          playlistItemsXml.push(playlistItemXml);
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const playlistFileName = `Ablaufplan_${dateStr}.proplaylist`;

    const playlistFileContent = `<?xml version="1.0" encoding="UTF-8"?>
<RVPlaylistDocument versionNumber="700" creatorCode="1349676881" category="Default" playlistName="${playlistFileName}">
    <array name="items">
        ${playlistItemsXml.join('\n        ')}
    </array>
</RVPlaylistDocument>`;

    zip.file(playlistFileName, playlistFileContent.trim());

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ProPresenter7_Ablaufplan_${dateStr}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};