export interface DataView {
  value: string;
  label: string;
  badgeCount?: number;
}

export const defaultViews: DataView[] = [
  { value: 'outline', label: 'Outline' },
  { value: 'past-performance', label: 'Past Performance', badgeCount: 3 },
  { value: 'key-personnel', label: 'Key Personnel', badgeCount: 2 },
  { value: 'focus-documents', label: 'Focus Documents' },
];
