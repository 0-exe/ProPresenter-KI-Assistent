import React, { useState, useEffect } from 'react';
import { PlaylistItem, ItemType } from '../types';

const ItemIcon: React.FC<{ type: ItemType }> = ({ type }) => {
  if (type === ItemType.SONG) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
      </svg>
    );
  }
  if (type === ItemType.SCRIPTURE) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.875 9.168-3.918" />
    </svg>
  );
};

const MiniLoader: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

interface EditablePlaylistItemProps {
  item: PlaylistItem;
  onUpdateItem: (id: string, updates: Partial<Pick<PlaylistItem, 'title' | 'content'>>) => void;
}

const EditablePlaylistItem: React.FC<EditablePlaylistItemProps> = ({ item, onUpdateItem }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableTitle, setEditableTitle] = useState(item.title);
  const [editableContent, setEditableContent] = useState(item.content);

  useEffect(() => {
    // If item content changes from parent (e.g., fetched), update local state if not editing
    if (!isEditing) {
      setEditableContent(item.content);
    }
  }, [item.content, isEditing]);

  const handleSave = () => {
    onUpdateItem(item.id, { title: editableTitle, content: editableContent });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditableTitle(item.title);
    setEditableContent(item.content);
    setIsEditing(false);
  };

  const isEditable = item.type === ItemType.SONG || item.type === ItemType.SCRIPTURE;

  return (
    <li className="p-4 flex items-start space-x-4">
      <div className="flex-shrink-0 pt-1">
          <ItemIcon type={item.type} />
      </div>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input 
            type="text"
            value={editableTitle}
            onChange={(e) => setEditableTitle(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white text-md font-semibold rounded-md p-1.5 focus:ring-sky-500 focus:border-sky-500"
          />
        ) : (
          <p className="text-md font-semibold text-slate-100 truncate">{item.title}</p>
        )}

        {item.isLoading ? (
          <div className="flex items-center space-x-2 mt-2">
              <MiniLoader />
              <span className="text-sm text-slate-400">Inhalt wird abgerufen...</span>
          </div>
        ) : (
          isEditing ? (
            <textarea
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              className="w-full mt-2 h-48 bg-slate-900 border border-slate-600 text-slate-300 text-sm font-mono rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
              style={{ resize: 'vertical' }}
            />
          ) : (
            <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap font-mono max-h-24 overflow-y-auto">
              {item.error ? 
                <span className="text-red-400">{item.error}</span> : 
                (item.content ? item.content : 'Kein Inhalt verfügbar.')
              }
            </p>
          )
        )}
      </div>
      {isEditable && (
        <div className="flex-shrink-0 pt-1 space-x-2">
            {isEditing ? (
                <>
                    <button onClick={handleSave} className="text-green-400 hover:text-green-300" title="Speichern">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button onClick={handleCancel} className="text-red-400 hover:text-red-300" title="Abbrechen">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.697a1 1 0 010-1.404z" clipRule="evenodd" />
                        </svg>
                    </button>
                </>
            ) : (
                <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-sky-400" title="Bearbeiten">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                    </svg>
                </button>
            )}
        </div>
      )}
    </li>
  );
};


interface PlaylistPreviewProps {
  playlist: PlaylistItem[];
  onUpdateItem: (id: string, updates: Partial<Pick<PlaylistItem, 'title' | 'content'>>) => void;
}

const PlaylistPreview: React.FC<PlaylistPreviewProps> = ({ playlist, onUpdateItem }) => {
  if (playlist.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3">
      <h2 className="text-2xl font-bold text-slate-100">Erstellte Playlist</h2>
      <ul className="bg-slate-800/50 rounded-lg border border-slate-700 divide-y divide-slate-700">
        {playlist.map(item => (
          <EditablePlaylistItem key={item.id} item={item} onUpdateItem={onUpdateItem} />
        ))}
      </ul>
    </div>
  );
};

export default PlaylistPreview;