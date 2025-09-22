import { PlaylistItem, ItemType } from '../types';

// Declaration for JSZip library loaded from CDN
declare var JSZip: any;

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

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
};

const generateRtf = (text: string, fontSize: number = 120): string => {
  // Basic RTF escaping
  let rtfText = text.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
  // Newlines to \par
  rtfText = rtfText.replace(/\n/g, '\\par\n');

  const rtf = `{\\rtf1\\ansi\\ansicpg1252\\cocoartf2709
\\cocoatextscaling0\\cocoaplatform0{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica-Bold;}
{\\colortbl;\\red255\\green255\\blue255;}
{\\*\\expandedcolortbl;;}
\\pard\\tx560\\tx1120\\tx1680\\tx2240\\tx2800\\tx3360\\tx3920\\tx4480\\tx5040\\tx5600\\tx6160\\tx6720\\pardirnatural\\qc\\partightenfactor0

\\f0\\b\\fs${fontSize * 2} \\cf1 ${rtfText}}`;
  return rtf;
};


const createSlideXml = (text: string, isTitle: boolean): { uuid: string, xml: string } => {
  const slideUUID = generateUUID();
  const textUUID = generateUUID();
  const rtfData = generateRtf(text, isTitle ? 140 : 120);
  
  const slideXml = `
    <RVDisplaySlide
      backgroundColor="0 0 0 1"
      enabled="1"
      highlightColor="0 0 0 0"
      hotKey=""
      label="${text.split('\n')[0].substring(0, 20)}"
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
          <NSString name="RTFData"><![CDATA[${rtfData}]]></NSString>
        </RVTextElement>
      </displayElements>
    </RVDisplaySlide>`;

    return { uuid: slideUUID, xml: slideXml };
};

const generateSinglePresentationXml = (item: PlaylistItem, translation: string): string => {
  const presentationUUID = generateUUID();
  const date = new Date();
  const lastDateUsed = date.toISOString().slice(0, 19);

  const groupName = item.type === ItemType.SCRIPTURE ? `${item.title} (${translation})` : item.title;
  
  // 1. Title slide
  const titleSlide = createSlideXml(groupName, true);
  let allSlidesXml = titleSlide.xml;
  const slideUUIDs = [titleSlide.uuid];

  // 2. Content slides
  if (item.content) {
    const contentSlides = item.content.split('---').map(s => s.trim()).filter(s => s);
    contentSlides.forEach(slideText => {
      const contentSlide = createSlideXml(slideText, false);
      allSlidesXml += contentSlide.xml;
      slideUUIDs.push(contentSlide.uuid);
    });
  }
  
  const groupUUID = generateUUID();
  const groupColor = item.type === ItemType.SONG ? "0 0 1 1" : "1 0.75 0 1";
  const groupsXml = `
    <RVSlideGrouping name="${groupName.replace(/"/g, '&quot;')}" color="${groupColor}" uuid="${groupUUID}">
      <array name="slides">
        ${slideUUIDs.map(uuid => `<NSString>${uuid}</NSString>`).join('\n        ')}
      </array>
    </RVSlideGrouping>
  `;

  const fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<RVPresentationDocument
  backgroundColor="0 0 0 1"
  height="1080"
  width="1920"
  versionNumber="600"
  docType="0"
  creatorCode="1349676880"
  lastDateUsed="${lastDateUsed}"
  usedCount="0"
  category="Default"
  resourcesDirectory=""
  notes=""
  os="2"
  buildNumber="1"
  UUID="${presentationUUID}"
  drawingBackgroundColor="0 0 0 0"
  CCLIDisplay="0"
  CCLIsongTitle="${item.type === ItemType.SONG ? item.title.replace(/"/g, '&quot;') : ''}"
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
          const headerItemXml = `
            <RVPlaylistItem type="RVPlaylistItemTypeHeader" UUID="${generateUUID()}" displayName="${item.title.replace(/"/g, '&quot;')}">
            </RVPlaylistItem>`;
          playlistItemsXml.push(headerItemXml);
      } else {
          presentationIndex++;
          const presentationName = item.type === ItemType.SCRIPTURE ? `${item.title} (${translation})` : item.title;
          const sanitizedTitle = presentationName.replace(/[/\\?%*:|"<>]/g, '-');
          const fileName = `${presentationIndex.toString().padStart(2, '0')} - ${sanitizedTitle}.pro6`;
          
          const presentationXml = generateSinglePresentationXml(item, translation);
          zip.file(fileName, presentationXml);

          const playlistItemXml = `
            <RVPlaylistItem 
                type="RVPlaylistItemTypePresentation" 
                slideShowDuration="0" 
                slideShowTransitionDuration="1" 
                slideShowTransition="RVSlideTransitionRandom" 
                UUID="${generateUUID()}" 
                displayName="${presentationName.replace(/"/g, '&quot;')}">
                <NSString name="filePath">./${fileName}</NSString>
            </RVPlaylistItem>`;
          playlistItemsXml.push(playlistItemXml);
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const playlistFileName = `Ablaufplan_${dateStr}.pro6plx`;

    const playlistFileContent = `<?xml version="1.0" encoding="UTF-8"?>
<RVPlaylistDocument versionNumber="600" creatorCode="1349676880" category="Default" playlistName="${playlistFileName}">
    <array name="items">
        ${playlistItemsXml.join('\n        ')}
    </array>
</RVPlaylistDocument>`;

    zip.file(playlistFileName, playlistFileContent.trim());

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ProPresenter_Ablaufplan_${dateStr}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
