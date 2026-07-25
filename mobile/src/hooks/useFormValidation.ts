import { useCallback, useState } from "react";

type Validator<T> = (values: T) => Partial<Record<keyof T, string>>;

/**
 * Shared form-state + validation hook. LoginScreen and RegisterScreen had
 * near-identical validate()/errors/setErrors blocks; centralizing this
 * means one place to fix validation UX (e.g. clear a field's error as
 * soon as the user edits it, instead of only on next submit).
 */
export function useFormValidation<T extends Record<string, any>>(initialValues: T, validator: Validator<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setField = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      // Clear that field's error as soon as the user starts fixing it —
      // waiting for full re-submit to clear stale errors feels laggy.
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  const validate = useCallback(() => {
    const nextErrors = validator(values);
    setErrors(nextErrors);
    setTouched(
      Object.keys(values).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Partial<Record<keyof T, boolean>>)
    );
    return Object.keys(nextErrors).length === 0;
  }, [values, validator]);

  return { values, errors, touched, setField, validate, setValues };
}
