import assert from 'node:assert/strict';
import test from 'node:test';
import { AlertCategory } from '@ecoalert/shared';
import { deriveImageValidation, imageValidationUnavailable } from '../services/image-validation.service';

test('clear waste evidence is valid and retains a supported suggestion', () => {
  const result = deriveImageValidation({ isEnvironmentalIncident: true, confidence: 0.92, suggestedCategory: AlertCategory.ILLEGAL_DUMPING, reason: 'Waste is accumulated in a public area.' }, 'test-model');
  assert.equal(result.decision, 'VALID');
  assert.equal(result.suggestedCategory, AlertCategory.ILLEGAL_DUMPING);
});

test('clearly unrelated evidence is invalid', () => {
  const result = deriveImageValidation({ isEnvironmentalIncident: false, confidence: 0.96, suggestedCategory: null, reason: 'The image is a personal selfie.' }, 'test-model');
  assert.equal(result.decision, 'INVALID');
});

test('ambiguous and low-confidence results remain unclassified suggestions', () => {
  const ambiguous = deriveImageValidation({ isEnvironmentalIncident: null, confidence: 0.55, suggestedCategory: AlertCategory.NOISE_POLLUTION, reason: 'The visible evidence is unclear.' }, 'test-model');
  assert.equal(ambiguous.decision, 'UNCERTAIN');
  assert.equal(ambiguous.suggestedCategory, AlertCategory.NOISE_POLLUTION);
  const lowConfidence = deriveImageValidation({ isEnvironmentalIncident: true, confidence: 0.32, suggestedCategory: AlertCategory.ILLEGAL_DUMPING, reason: 'The evidence is weak.' }, 'test-model');
  assert.equal(lowConfidence.suggestedCategory, null);
});

test('provider unavailability creates a manual-review result instead of a rejection', () => {
  assert.equal(imageValidationUnavailable().decision, 'UNAVAILABLE');
});
