
import React from 'react';

interface StatCardProps {
    label: string;
    value: string;
    icon: string;
    color: string;
    sub?: string;
    change?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, sub, change }) => {
    return (
        <div className="bg-surface-dark border border-border-dark rounded-xl p-6 relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
            <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                <span className="material-symbols-outlined text-6xl">{icon}</span>
            </div>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="text-text-dim text-sm font-medium">{label}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold text-white">{value}</h3>
                    {change && (
                        <span className="text-emerald-500 text-xs font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[14px]">trending_up</span> {change}
                        </span>
                    )}
                </div>
                <p className="text-text-dim text-xs mt-2">{sub || 'Dados em tempo real'}</p>
            </div>
        </div>
    );
};

export default StatCard;
