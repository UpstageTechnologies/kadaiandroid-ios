// context/ThemeContext.js
import React, { createContext, useState } from 'react';
import { colors } from '../theme/tokens';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const theme = {
    isDarkMode,
    toggleTheme: () => setIsDarkMode(prev => !prev),
    
    // முக்கிய வண்ணங்கள்
    bgMain: isDarkMode ? '#101828' : colors.canvas,
    bgCard: isDarkMode ? '#1D2939' : colors.surface,
    textMain: isDarkMode ? '#ffffff' : colors.ink,
    textSub: isDarkMode ? '#98A2B3' : colors.muted,
    border: isDarkMode ? '#344054' : colors.border,
    
    // நிலையான வண்ணங்கள் (Header எப்போதும் டார்க் ஆகவே இருக்கும் என்பதால்)
    headerBg: colors.dark,
    headerText: '#ffffff',
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
