import { DivideIcon as LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    type: 'up' | 'down';
  };
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  onClick?: () => void;
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-600 border-amber-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
};

const hoverClasses = {
  blue: 'hover:bg-blue-100 hover:border-blue-300',
  green: 'hover:bg-emerald-100 hover:border-emerald-300',
  yellow: 'hover:bg-amber-100 hover:border-amber-300',
  red: 'hover:bg-red-100 hover:border-red-300',
  purple: 'hover:bg-purple-100 hover:border-purple-300',
};

export default function MetricCard({ title, value, icon: Icon, trend, color, onClick }: MetricCardProps) {
  const CardComponent = onClick ? 'button' : 'div';
  
  const colorBgMap = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-amber-100',
    red: 'bg-red-100',
    purple: 'bg-purple-100',
  };

  const colorTextMap = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-amber-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
  };
  
  return (
    <CardComponent
      onClick={onClick}
      className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6 transition-all duration-200 ${
        onClick ? `cursor-pointer hover:shadow-md ${hoverClasses[color]}` : 'hover:shadow-md'
      } text-left w-full`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-xs sm:text-sm font-medium text-gray-600">{title}</p>
          <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-900 truncate">{value}</p>
          {trend && (
            <p className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${trend.type === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend.type === 'up' ? '↗' : '↘'} {trend.value}% vs mês anterior
            </p>
          )}
          {onClick && (
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Clique para ver detalhes</p>
          )}
        </div>
        <div className={`${colorBgMap[color]} p-2 sm:p-3 rounded-lg flex-shrink-0`}>
          <Icon className={`h-4 sm:h-5 w-4 sm:w-5 ${colorTextMap[color]}`} />
        </div>
      </div>
    </CardComponent>
  );
}