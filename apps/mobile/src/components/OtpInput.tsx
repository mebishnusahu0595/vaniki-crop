import { createRef, memo, useMemo } from 'react';
import { TextInput, View } from 'react-native';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const OtpInput = memo(function OtpInput({ value, onChange }: OtpInputProps) {
  const refs = useMemo(() => Array.from({ length: 6 }, () => createRef<TextInput>()), []);

  return (
    <View className="flex-row justify-between gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <TextInput
          key={index}
          ref={refs[index]}
          value={value[index] || ''}
          keyboardType="number-pad"
          maxLength={1}
          onChangeText={(digit) => {
            const nextValue = value.split('');
            nextValue[index] = digit;
            onChange(nextValue.join('').slice(0, 6));

            if (digit && index < refs.length - 1) {
              refs[index + 1].current?.focus();
            }
          }}
          onKeyPress={(event) => {
            if (event.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
              refs[index - 1].current?.focus();
            }
          }}
          className="h-14 w-12 rounded-[18px] border border-primary-100 bg-white text-center text-xl font-black text-primary-900"
        />
      ))}
    </View>
  );
});
