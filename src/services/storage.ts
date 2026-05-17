import type { DiagnosisInput } from "../types";

const DIAGNOSIS_KEY = "skin_affiliate_mvp_diagnosis";

export function loadDiagnosis() {
  const raw = localStorage.getItem(DIAGNOSIS_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DiagnosisInput;
  } catch {
    return null;
  }
}

export function saveDiagnosis(input: DiagnosisInput) {
  localStorage.setItem(DIAGNOSIS_KEY, JSON.stringify(input));
}

export function clearDiagnosis() {
  localStorage.removeItem(DIAGNOSIS_KEY);
}
