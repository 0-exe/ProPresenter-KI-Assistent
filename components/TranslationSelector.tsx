
import React from 'react';

const BIBLE_TRANSLATIONS = ["Lutherbibel 2017", "Elberfelder Bibel", "Hoffnung für Alle", "BasisBibel", "New International Version (NIV)", "King James Version (KJV)", "English Standard Version (ESV)"];

interface TranslationSelectorProps {
  selectedTranslation: string;
  onTranslationChange: (translation: string) => void;
  disabled: boolean;
}

const TranslationSelector: React.FC<TranslationSelectorProps> = ({ selectedTranslation, onTranslationChange, disabled }) => {
  return (
    <div>
      <label htmlFor="translation" className="block mb-2 text-sm font-medium text-slate-300">
        Bibelübersetzung für Schrifttexte
      </label>
      <select
        id="translation"
        value={selectedTranslation}
        onChange={(e) => onTranslationChange(e.target.value)}
        disabled={disabled}
        className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5 placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {BIBLE_TRANSLATIONS.map(translation => (
          <option key={translation} value={translation}>{translation}</option>
        ))}
      </select>
    </div>
  );
};

export default TranslationSelector;