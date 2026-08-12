import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface SelectionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  onSelect: (item: string) => void;
  selectedValue?: string;
}

export const SelectionModal: React.FC<SelectionModalProps> = ({
  visible,
  onClose,
  title,
  options,
  onSelect,
  selectedValue,
}) => {
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, search]);

  const handleClose = () => {
    setSearch('');
    setIsExpanded(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        {/* Backdrop Press to Close */}
        <Pressable style={{ flex: 1 }} onPress={handleClose} />

        {/* Bottom Sheet Container */}
        <View
          style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            height: isExpanded ? '94%' : '82%',
            maxHeight: '94%',
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {/* Top Drag Handle Bar (Drag to Expand / Collapse) */}
          <Pressable
            onPress={() => setIsExpanded((prev) => !prev)}
            style={{ paddingVertical: 8, alignItems: 'center' }}
            hitSlop={12}
          >
            <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' }} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8', marginTop: 4 }}>
              {isExpanded ? '▼ Tap to restore height' : '▲ Tap or drag to top'}
            </Text>
          </Pressable>

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#143D2E' }}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setIsExpanded((prev) => !prev)}
                style={{
                  padding: 6,
                  borderRadius: 12,
                  backgroundColor: '#F1F5F9',
                }}
              >
                <Feather name={isExpanded ? 'minimize-2' : 'maximize-2'} size={18} color="#143D2E" />
              </Pressable>

              <Pressable onPress={handleClose} style={{ padding: 6, borderRadius: 12, backgroundColor: '#F1F5F9' }}>
                <Feather name="x" size={20} color="#143D2E" />
              </Pressable>
            </View>
          </View>

          {/* Search Input Bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F4F7F6',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 14,
            }}
          >
            <Feather name="search" size={18} color="#7A978B" style={{ marginRight: 10 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${title.toLowerCase()}...`}
              placeholderTextColor="#7A978B"
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
              style={{ flex: 1, fontSize: 15, color: '#143D2E', fontWeight: '600', outlineStyle: 'none', outlineWidth: 0 } as any}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')}>
                <Feather name="x-circle" size={18} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>

          {/* Options List */}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  handleClose();
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F0F5F2',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: selectedValue === item ? '800' : '500',
                    color: selectedValue === item ? '#2D6A4F' : '#334155',
                  }}
                >
                  {item}
                </Text>
                {selectedValue === item && <Feather name="check" size={18} color="#2D6A4F" />}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '600' }}>
                  No matching options found
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};
