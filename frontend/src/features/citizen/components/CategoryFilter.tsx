import { motion } from 'framer-motion';
import { 
  Trash2, Droplets, Wind, CloudRain, 
  Flame, Volume2, Building, MoreHorizontal 
} from 'lucide-react';
import { Alert, AlertCategory } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  alerts: Alert[];
}

const CATEGORIES = [
  { id: 'illegal_dumping', name: 'Rác thải trái phép', icon: Trash2 },
  { id: 'water_pollution', name: 'Ô nhiễm nguồn nước', icon: Droplets },
  { id: 'air_pollution', name: 'Ô nhiễm không khí', icon: Wind },
  { id: 'flooding', name: 'Ngập lụt', icon: CloudRain },
  { id: 'fire', name: 'Cháy / Đốt rác', icon: Flame },
  { id: 'noise_pollution', name: 'Ô nhiễm tiếng ồn', icon: Volume2 },
  { id: 'construction_waste', name: 'Rác thải xây dựng', icon: Building },
  { id: 'other', name: 'Khác', icon: MoreHorizontal },
];

export function CategoryFilter({ selectedCategory, onSelectCategory, alerts }: CategoryFilterProps) {
  const getCategoryCount = (categoryId: string) => {
    return alerts.filter(a => a.category === categoryId as AlertCategory).length;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.id;
          const count = getCategoryCount(category.id);

          return (
            <motion.button
              key={category.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectCategory(isSelected ? null : category.id)}
              className={cn(
                "flex items-center p-4 rounded-xl text-left transition-colors border",
                "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm hover:shadow-md",
                isSelected 
                  ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary" 
                  : "border-gray-200 dark:border-slate-700 hover:border-primary/50"
              )}
            >
              <div className={cn(
                "p-3 rounded-lg mr-4",
                isSelected 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm truncate",
                  isSelected ? "text-primary dark:text-primary-foreground" : "text-gray-900 dark:text-gray-100"
                )}>
                  {category.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {count} sự cố
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
