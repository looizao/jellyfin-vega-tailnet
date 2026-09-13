import React, {useState} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';

export function ActionButton({
  label,
  onPress,
  disabled = false,
  preferred = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  preferred?: boolean;
  secondary?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        focused && styles.focused,
        disabled && styles.disabled,
      ]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 26,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#7c4dff',
    borderWidth: 3,
    borderColor: 'transparent',
    marginRight: 14,
    marginTop: 12,
  },
  secondary: {backgroundColor: '#223149'},
  focused: {borderColor: '#a5f3fc', backgroundColor: '#6040c5'},
  disabled: {opacity: 0.4},
  text: {fontSize: 20, fontWeight: '600', color: '#ffffff'},
});
