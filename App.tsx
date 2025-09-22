import React, { useState, useCallback } from 'react';
import { ItemType, PlaylistItem, ScheduleItem } from './types';
import * as geminiService from './services/geminiService';
import * as fileUtils from './utils/fileUtils';
import FileUpload from './components/FileUpload';
import TranslationSelector from './components/TranslationSelector';
import PlaylistPreview from './components/PlaylistPreview';
import Loader from './components/Loader';

const TutorialSection: React.FC = () => (
    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700 space-y-4 mt-8">
        <h3 className="text-xl font-bold text-slate-100">Anleitung zum Import in ProPresenter 7</h3>
        <ol className="list-decimal list-inside space-y-3 text-slate-300">
            <li>Laden Sie die <strong>.zip-Datei</strong> über den Download-Button herunter.</li>
            <li><strong>Entpacken Sie die .zip-Datei.</strong> Sie erhalten einen Ordner mit einer <strong>.proplaylist-Datei</strong> und mehreren <strong>.pro-Präsentationsdateien</strong>.</li>
            <li>Öffnen Sie ProPresenter 7.</li>
            <li>Ziehen Sie die <strong>.proplaylist-Datei</strong> per Drag &amp; Drop in den Playlist-Bereich von ProPresenter.</li>
            <li>Stellen Sie sicher, dass sich alle .pro-Dateien im selben Ordner wie die .proplaylist-Datei befinden, wenn Sie sie importieren.</li>
            <li className='!mt-4 text-sky-300 bg-sky-900/50 p-3 rounded-md border border-sky-800'>
                <strong>Ergebnis:</strong> Eine vollständige ProPresenter 7-Playlist wird importiert. Jeder Song und Schrifttext ist eine <strong>eigene Präsentation</strong>, und andere Ablaufpunkte (wie "Predigt") erscheinen als <strong>Überschriften</strong> in der Playlist.
            </li>
        </ol>
    </div>
);


const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [translation, setTranslation] = useState<string>("Lutherbibel 2017");
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPlaylist([]);
    setError(null);
  };

  const processPlaylistContent = async (parsedItems: ScheduleItem[]) => {
    for (const item of parsedItems) {
      if (item.type === ItemType.EVENT) continue;
      
      setLoadingMessage(`Inhalte für "${item.title}" werden abgerufen...`);
      
      let content = '';
      let fetchError: string | undefined = undefined;

      try {
        if (item.type === ItemType.SONG) {
          content = await geminiService.getSongLyrics(item.title);
        } else if (item.type === ItemType.SCRIPTURE) {
          content = await geminiService.getScriptureText(item.title, translation);
        }
      } catch (e) {
         fetchError = e instanceof Error ? e.message : 'Ein unbekannter Fehler ist aufgetreten.';
         content = '';
      }

      setPlaylist(prev => prev.map(pItem => 
        pItem.id === `${item.type}-${item.title}` ? { ...pItem, content, isLoading: false, error: fetchError } : pItem
      ));
    }
  };

  const handleGeneratePlaylist = useCallback(async () => {
    if (!file) {
      setError("Bitte wählen Sie zuerst eine Datei aus.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPlaylist([]);

    try {
      setLoadingMessage("Datei wird für die Analyse vorbereitet...");
      
      let scheduleContent: { type: 'image' | 'text', data: string, mimeType?: string };

      if (file.type.startsWith('image/')) {
        const base64Image = await fileUtils.fileToBase64(file);
        scheduleContent = { type: 'image', data: base64Image, mimeType: file.type };
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'text/plain'
      ) {
        const textContent = await fileUtils.extractTextFromFile(file);
        if (!textContent || !textContent.trim()) {
          throw new Error("Das Dokument scheint leer zu sein oder konnte nicht gelesen werden.");
        }
        scheduleContent = { type: 'text', data: textContent };
      } else {
        throw new Error(`Nicht unterstützter Dateityp: ${file.type}. Bitte laden Sie ein Bild, eine DOCX- oder eine TXT-Datei hoch.`);
      }


      setLoadingMessage("Gottesdienstplan wird analysiert...");
      const parsedItems = await geminiService.parseSchedule(scheduleContent);
      
      if (!parsedItems || parsedItems.length === 0) {
        throw new Error("Es konnten keine Einträge im Plan gefunden werden. Bitte versuchen Sie es mit einer anderen Datei.");
      }

      const initialPlaylist: PlaylistItem[] = parsedItems.map(item => ({
        ...item,
        id: `${item.type}-${item.title}`,
        content: item.type === ItemType.EVENT ? 'Dies ist ein nicht-präsentierbares Ereignis.' : '',
        isLoading: item.type !== ItemType.EVENT,
      }));
      setPlaylist(initialPlaylist);

      await processPlaylistContent(parsedItems);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ein unerwarteter Fehler ist aufgetreten.";
      console.error(err);
      setError(errorMessage);
      setPlaylist([]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, translation]);


  const handleDownload = async () => {
    if (playlist.length === 0 || isDownloading) return;

    setIsDownloading(true);
    setError(null);
    try {
      await fileUtils.generateProPresenterPlaylist(playlist, translation);
    } catch (err) {
      console.error("Error generating playlist zip:", err);
      setError("Fehler beim Erstellen der Playlist-ZIP-Datei.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpdatePlaylistItem = (itemId: string, updates: Partial<Pick<PlaylistItem, 'title' | 'content'>>) => {
      setPlaylist(prevPlaylist => 
          prevPlaylist.map(item => 
              item.id === itemId ? { ...item, ...updates } : item
          )
      );
  };
  
  const isPlaylistReady = playlist.length > 0 && !playlist.some(p => p.isLoading);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">
                ProPresenter KI-Assistent
            </h1>
            <p className="mt-2 text-lg text-slate-400">
                Erstellen Sie Ihre Gottesdienst-Playlist in Sekunden.
            </p>
        </header>

        <main className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700 space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-100 mb-1">1. Ablaufplan hochladen</h2>
                    <p className="text-sm text-slate-400 mb-4">Laden Sie eine Bild-, DOCX- oder TXT-Datei Ihres Gottesdienstablaufplans hoch.</p>
                    <FileUpload onFileSelect={handleFileSelect} disabled={isLoading} />
                </div>
                 <div>
                    <h2 className="text-xl font-bold text-slate-100 mb-1">2. Bibelübersetzung wählen</h2>
                    <p className="text-sm text-slate-400 mb-4">Wählen Sie die Übersetzung für alle Schrifttexte aus.</p>
                    <TranslationSelector selectedTranslation={translation} onTranslationChange={setTranslation} disabled={isLoading} />
                </div>
                <button
                    onClick={handleGeneratePlaylist}
                    disabled={!file || isLoading}
                    className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center space-x-2 transition-transform duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Wird verarbeitet...</span>
                        </>
                    ) : (
                        <span>3. Playlist erstellen</span>
                    )}
                </button>
            </div>
            
            {isLoading && loadingMessage && <Loader message={loadingMessage} />}
            
            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
                    <strong className="font-bold">Fehler: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <PlaylistPreview playlist={playlist} onUpdateItem={handleUpdatePlaylistItem} />
            
            {isPlaylistReady && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition-transform duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isDownloading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Playlist wird erstellt...</span>
                    </>
                  ) : (
                    'ProPresenter 7-Playlist (.zip) herunterladen'
                  )}
                </button>
              </div>
            )}

            <TutorialSection />
        </main>
      </div>
    </div>
  );
};

export default App;