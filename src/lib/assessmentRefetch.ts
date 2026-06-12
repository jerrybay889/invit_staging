type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const triggerAssessmentRefetch = () => {
  listeners.forEach(fn => fn());
};

export const onAssessmentRefetch = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
