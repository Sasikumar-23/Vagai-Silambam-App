import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en } from './en';
import { ta } from './ta';

export type Language = 'en' | 'ta';

interface I18nContextProps {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: typeof en;
  getLocalized: (enText?: string | null, taText?: string | null) => string;
}

const LANGUAGE_KEY = '@vagai_silambam_lang';

const I18nContext = createContext<I18nContextProps>({
  language: 'en',
  setLanguage: async () => {},
  toggleLanguage: async () => {},
  t: en,
  getLocalized: () => '',
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    (async () => {
      try {
        const storedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (storedLang === 'en' || storedLang === 'ta') {
          setLanguageState(storedLang);
        }
      } catch (e) {
        console.warn('Failed to load language preference', e);
      }
    })();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    } catch (e) {
      console.warn('Failed to save language preference', e);
    }
  };

  const toggleLanguage = async () => {
    const nextLang: Language = language === 'en' ? 'ta' : 'en';
    await setLanguage(nextLang);
  };

  const getLocalized = (enText?: string | null, taText?: string | null): string => {
    if (language === 'ta') {
      return (taText && taText.trim().length > 0) ? taText : (enText || '');
    }
    return (enText && enText.trim().length > 0) ? enText : (taText || '');
  };

  const currentTranslations = language === 'ta' ? (ta as typeof en) : en;

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t: currentTranslations,
        getLocalized,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
