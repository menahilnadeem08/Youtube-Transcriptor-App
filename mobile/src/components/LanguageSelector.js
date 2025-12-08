import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_LANGUAGES } from '../utils/languages';

const { width, height } = Dimensions.get('window');

const LANGUAGE_FLAGS = {
  en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', pt: '🇵🇹', ru: '🇷🇺',
  ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', ar: '🇸🇦', hi: '🇮🇳', ur: '🇵🇰', tr: '🇹🇷',
  pl: '🇵🇱', nl: '🇳🇱', sv: '🇸🇪', da: '🇩🇰', no: '🇳🇴', fi: '🇫🇮', el: '🇬🇷',
  he: '🇮🇱', th: '🇹🇭', vi: '🇻🇳', id: '🇮🇩', ms: '🇲🇾', tl: '🇵🇭', cs: '🇨🇿',
  hu: '🇭🇺', ro: '🇷🇴', bg: '🇧🇬', hr: '🇭🇷', sk: '🇸🇰', sl: '🇸🇮', uk: '🇺🇦',
  bn: '🇧🇩', ta: '🇱🇰', te: '🇮🇳', mr: '🇮🇳', gu: '🇮🇳', kn: '🇮🇳', ml: '🇮🇳',
  pa: '🇮🇳', fa: '🇮🇷', sw: '🇹🇿', zu: '🇿🇦', af: '🇿🇦', ca: '🇪🇸', eu: '🇪🇸',
  gl: '🇪🇸', is: '🇮🇸', ga: '🇮🇪', mt: '🇲🇹', cy: '🇬🇧',
};

export default function LanguageSelector({ 
  visible, 
  onClose, 
  selectedLanguage, 
  onSelectLanguage 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setDropdownOpen(true);
      // Focus search input after a short delay
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    } else {
      setSearchQuery('');
      setDropdownOpen(false);
    }
  }, [visible]);

  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) {
      return SUPPORTED_LANGUAGES;
    }
    
    const query = searchQuery.toLowerCase();
    return SUPPORTED_LANGUAGES.filter(
      lang => 
        lang.name.toLowerCase().includes(query) ||
        lang.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelectLanguage = (langCode) => {
    onSelectLanguage(langCode);
    setSearchQuery('');
    setDropdownOpen(false);
    onClose();
  };

  const selectedLanguageData = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);
  const selectedFlag = LANGUAGE_FLAGS[selectedLanguage] || '🌐';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.popupContainer}>
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Select Language</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search languages..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Dropdown */}
            <View style={styles.dropdownContainer}>
              <View style={styles.dropdown}>
                {filteredLanguages.length > 0 ? (
                  <FlatList
                    data={filteredLanguages}
                    keyExtractor={(item) => item.code}
                    style={styles.dropdownList}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    renderItem={({ item }) => {
                      const isSelected = item.code === selectedLanguage;
                      const flag = LANGUAGE_FLAGS[item.code] || '🌐';
                      
                      return (
                        <TouchableOpacity
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                          ]}
                          onPress={() => handleSelectLanguage(item.code)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.dropdownItemContent}>
                            <Text style={styles.flag}>{flag}</Text>
                            <View style={styles.languageInfo}>
                              <Text style={[
                                styles.languageName,
                                isSelected && styles.languageNameSelected
                              ]}>
                                {item.name}
                              </Text>
                              <Text style={styles.languageCode}>{item.code.toUpperCase()}</Text>
                            </View>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={22} color="#667eea" />
                          )}
                        </TouchableOpacity>
                      );
                    }}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Ionicons name="search" size={32} color="#ccc" />
                        <Text style={styles.emptyText}>No languages found</Text>
                      </View>
                    }
                  />
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search" size={32} color="#ccc" />
                    <Text style={styles.emptyText}>No languages found</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Selected Language Display */}
            {selectedLanguageData && (
              <View style={styles.selectedContainer}>
                <Text style={styles.selectedLabel}>Currently Selected:</Text>
                <View style={styles.selectedLanguage}>
                  <Text style={styles.selectedFlag}>{selectedFlag}</Text>
                  <Text style={styles.selectedName}>{selectedLanguageData.name}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupContainer: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    maxHeight: height * 0.75,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    margin: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  dropdownContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dropdown: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    maxHeight: height * 0.4,
    overflow: 'hidden',
  },
  dropdownList: {
    maxHeight: height * 0.4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  dropdownItemSelected: {
    backgroundColor: '#f0f4ff',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  languageNameSelected: {
    color: '#667eea',
  },
  languageCode: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  selectedContainer: {
    padding: 16,
    margin: 20,
    marginTop: 12,
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  selectedLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  selectedLanguage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedFlag: {
    fontSize: 24,
    marginRight: 10,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
});
