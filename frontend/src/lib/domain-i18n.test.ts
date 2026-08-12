import assert from 'node:assert/strict';
import test from 'node:test';
import { translations } from '@/contexts/LanguageContext';
import {
  getAnalysisModeDisplay,
  getCategoryDisplay,
  getConfidenceSourceDisplay,
  getSeverityDisplay,
  getStatusDisplay,
  getVisionObjectDisplay,
  getWeatherConditionDisplay,
  resolveLocalizedAiText,
} from './domain-i18n';

test('Web dictionaries have identical VI and EN key sets', () => {
  assert.deepEqual(Object.keys(translations.vi).sort(), Object.keys(translations.en).sort());
});

test('canonical domain codes are localized without modifying their values', () => {
  assert.equal(getStatusDisplay('vi', 'IN_PROGRESS'), 'Đang xử lý');
  assert.equal(getStatusDisplay('en', 'IN_PROGRESS'), 'In Progress');
  assert.equal(getCategoryDisplay('vi', 'ILLEGAL_DUMPING'), 'Đổ rác trái phép');
  assert.equal(getSeverityDisplay('en', 'CRITICAL'), 'Critical');
  assert.equal(getAnalysisModeDisplay('vi', 'VISION_ONLY'), 'Chỉ phân tích hình ảnh');
  assert.equal(getAnalysisModeDisplay('vi', 'FULL_MULTIMODAL'), 'Phân tích đa phương thức đầy đủ');
  assert.equal(getConfidenceSourceDisplay('vi', 'CATEGORY'), 'Phân loại');
  assert.equal(getConfidenceSourceDisplay('en', 'CATEGORY'), 'Category');
  assert.equal(getVisionObjectDisplay('vi', 'plastic_bag'), 'Túi nhựa');
  assert.equal(getVisionObjectDisplay('en', 'plastic_bag'), 'Plastic Bag');
});

test('provider weather prose is normalized for Vietnamese display', () => {
  assert.equal(getWeatherConditionDisplay('vi', 'broken clouds'), 'Có mây');
  assert.equal(getWeatherConditionDisplay('en', 'light rain'), 'Rain');
});

test('localized AI prose always prefers the active locale before legacy English', () => {
  const localized = { vi: 'Tóm tắt tiếng Việt', en: 'English summary' };
  assert.equal(resolveLocalizedAiText(localized, 'Legacy English', 'vi'), 'Tóm tắt tiếng Việt');
  assert.equal(resolveLocalizedAiText(localized, 'Legacy English', 'en'), 'English summary');
  assert.equal(resolveLocalizedAiText(undefined, 'Legacy English', 'vi'), 'Legacy English');
  assert.equal(resolveLocalizedAiText({ vi: null, en: 'English summary' }, 'Legacy English', 'vi'), 'Legacy English');
  // Calling the pure resolver again with a different locale models an immediate React rerender on language change.
  assert.equal(resolveLocalizedAiText(localized, 'Legacy English', 'vi'), 'Tóm tắt tiếng Việt');
  assert.equal(resolveLocalizedAiText(localized, 'Legacy English', 'en'), 'English summary');
});
