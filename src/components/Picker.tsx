import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';

interface PickerItem {
  label: string;
  value: string;
}

interface PickerProps {
  items: PickerItem[];
  selectedValue: string | null;
  onValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export const Picker: React.FC<PickerProps> = ({
  items,
  selectedValue,
  onValueChange,
  placeholder,
  className = '',
}) => {
  const [isVisible, setIsVisible] = React.useState(false);

  const selectedItem = items.find(item => item.value === selectedValue);

  const renderItem = ({ item }: { item: PickerItem }) => (
    <TouchableOpacity
      className="p-4 border-b border-gray-200 bg-white"
      onPress={() => {
        onValueChange(item.value);
        setIsVisible(false);
      }}
    >
      <Text className="text-gray-900 text-base">{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        className={`border border-gray-300 rounded-lg px-4 py-3 bg-white ${className}`}
        onPress={() => setIsVisible(true)}
      >
        <View className="flex-row justify-between items-center">
          <Text className={selectedItem ? "text-gray-900" : "text-gray-500"}>
            {selectedItem ? selectedItem.label : placeholder}
          </Text>
          <Text className="text-gray-400">▼</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-lg max-h-96">
            <View className="p-4 border-b border-gray-200 bg-gray-50">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-semibold text-gray-900">{placeholder}</Text>
                <TouchableOpacity onPress={() => setIsVisible(false)}>
                  <Text className="text-blue-600 text-base">Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.value}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};