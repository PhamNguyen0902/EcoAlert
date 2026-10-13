import React, { forwardRef } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      containerStyle,
      leftIcon,
      rightIcon,
      style,
      multiline,
      placeholderTextColor,
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            multiline && styles.multilineInputContainer,
            Boolean(error) && { borderColor: colors.destructive },
          ]}
        >
          {leftIcon ? <View style={[styles.leftIcon, multiline && styles.multilineIcon]}>{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            multiline={multiline}
            textAlignVertical={multiline ? "top" : "center"}
            style={[
              styles.input,
              { color: colors.text },
              multiline && styles.multilineInput,
              style,
            ]}
            placeholderTextColor={placeholderTextColor || colors.textMuted}
            {...props}
          />
          {rightIcon ? <View style={[styles.rightIcon, multiline && styles.multilineIcon]}>{rightIcon}</View> : null}
        </View>
        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        ) : hint ? (
          <Text style={[styles.hintText, { color: colors.textMuted }]}>{hint}</Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  multilineInputContainer: {
    minHeight: 110,
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    paddingVertical: 8,
  },
  multilineInput: {
    minHeight: 86,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  leftIcon: {
    marginRight: 10,
  },
  rightIcon: {
    marginLeft: 10,
  },
  multilineIcon: {
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  hintText: {
    fontSize: 12,
    marginTop: 4,
  },
});
