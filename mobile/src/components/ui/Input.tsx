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
import { COLORS } from "../../utils/constants";

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
      ...props
    },
    ref
  ) => {
    return (
      <View style={[styles.container, containerStyle]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View
          style={[
            styles.inputContainer,
            multiline && styles.multilineInputContainer,
            Boolean(error) && styles.errorBorder,
          ]}
        >
          {leftIcon ? <View style={[styles.leftIcon, multiline && styles.multilineIcon]}>{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            multiline={multiline}
            textAlignVertical={multiline ? "top" : "center"}
            style={[
              styles.input,
              multiline && styles.multilineInput,
              style,
            ]}
            placeholderTextColor={COLORS.textMuted}
            {...props}
          />
          {rightIcon ? <View style={[styles.rightIcon, multiline && styles.multilineIcon]}>{rightIcon}</View> : null}
        </View>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hintText}>{hint}</Text>
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
    color: COLORS.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  multilineInputContainer: {
    minHeight: 110,
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  errorBorder: {
    borderColor: COLORS.destructive,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: COLORS.text,
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
    color: COLORS.destructive,
    marginTop: 4,
    fontWeight: "500",
  },
  hintText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
