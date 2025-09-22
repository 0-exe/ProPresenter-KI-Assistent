
export enum ItemType {
  SONG = 'song',
  SCRIPTURE = 'scripture',
  EVENT = 'event',
}

export interface ScheduleItem {
  type: ItemType;
  title: string;
}

export interface PlaylistItem extends ScheduleItem {
  id: string;
  content: string;
  isLoading: boolean;
  error?: string;
}
