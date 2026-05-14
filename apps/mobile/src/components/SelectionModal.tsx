import React from 'react';
import { Modal, View, Text, Pressable, FlatList, SafeAreaView } from 'react-native';
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
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '70%', padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#143D2E' }}>{title}</Text>
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Feather name="x" size={24} color="#143D2E" />
            </Pressable>
          </View>
          
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={{
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F0F5F2',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: selectedValue === item ? '800' : '500',
                  color: selectedValue === item ? '#2D6A4F' : '#334155'
                }}>
                  {item}
                </Text>
                {selectedValue === item && <Feather name="check" size={18} color="#2D6A4F" />}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};
