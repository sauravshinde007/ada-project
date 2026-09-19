import React, { useMemo } from 'react';
import './Subtitles.css';

interface SubtitlesProps {
  text: string;
  progress: number;
}

export const Subtitles: React.FC<SubtitlesProps> = ({ text, progress }) => {
  // Split the sentence into an array of words
  const words = useMemo(() => text.split(' '), [text]);
  
  // Calculate how many words should be visible right now based on the audio progress
  const wordsToShow = Math.ceil(words.length * progress);

  return (
    <div className="subtitle-container">
      <p className="subtitle-text">
        {words.map((word, index) => (
          <span
            key={index}
            className={`subtitle-word ${index < wordsToShow ? 'visible' : 'hidden'}`}
          >
            {word}{' '}
          </span>
        ))}
      </p>
    </div>
  );
};

