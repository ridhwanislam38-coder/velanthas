export const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randFloat = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

export const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
};
