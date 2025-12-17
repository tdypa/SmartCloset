export enum Season {
  WARM = 'Warm (Summer/Spring)',
  COLD = 'Cold (Winter/Fall)',
  ALL = 'All Year'
}

export enum CategoryL1 {
  TOP = 'Top',
  BOTTOM = 'Bottom',
  SHOES = 'Shoes',
  DRESS = 'Dress',
  HAT = 'Hat'
}

export interface CategoryStructure {
  [CategoryL1.TOP]: string[];
  [CategoryL1.BOTTOM]: string[];
  [CategoryL1.SHOES]: string[];
  [CategoryL1.DRESS]: string[];
  [CategoryL1.HAT]: string[];
}

export const DEFAULT_CATEGORIES: CategoryStructure = {
  [CategoryL1.TOP]: ['T-Shirt', 'Hoodie', 'Shirt', 'Jacket', 'Coat'],
  [CategoryL1.BOTTOM]: ['Jeans', 'Shorts', 'Sweatpants', 'Skirt'],
  [CategoryL1.SHOES]: ['Sneakers', 'Boots', 'Sandals', 'Formal'],
  [CategoryL1.DRESS]: ['Casual', 'Evening', 'Sundress'],
  [CategoryL1.HAT]: ['Cap', 'Beanie', 'Bucket Hat']
};

export const COLORS = [
  'Black', 'White', 'Gray', 'Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Pink', 'Brown', 'Beige', 'Orange'
];

export interface ClothingItem {
  id: string;
  imageData: string; // Base64
  categoryL1: CategoryL1;
  categoryL2: string;
  color: string;
  season: Season;
  createdAt: number;
  trashDate?: number; // If present, item is in trash
  isDeleted: boolean;
}

export interface Outfit {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  items: ClothingItem[];
  rating?: number;
}

export type FilterState = {
  categoryL1: CategoryL1 | 'All';
  search: string;
  season: Season | 'All';
  color: string | 'All';
}
