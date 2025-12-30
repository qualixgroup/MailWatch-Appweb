
import React from 'react';

export type StatusType = 'active' | 'paused' | 'success' | 'error' | 'info';

interface StatusBadgeProps {
    status: StatusType;
    label?: string;
    withDot?: boolean;
    size?: 'sm' | 'md';
}

const statusConfig = {
    active: {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-500',
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-500',
        pulse: true
    },
    paused: {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-500',
        border: 'border-yellow-500/20',
        dot: 'bg-yellow-500',
        pulse: false
    },
    success: {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-500',
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-500',
        pulse: false
    },
    error: {
        bg: 'bg-red-500/10',
        text: 'text-red-500',
        border: 'border-red-500/20',
        dot: 'bg-red-500',
        pulse: false
    },
    info: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-500',
        border: 'border-blue-500/20',
        dot: 'bg-blue-500',
        pulse: false
    }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    label,
    withDot = true,
    size = 'md'
}) => {
    const config = statusConfig[status];
    const sizeClasses = size === 'sm'
        ? 'px-2 py-0.5 text-[10px]'
        : 'px-2.5 py-1 text-xs';

    return (
        <span className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-full font-bold border ${config.bg} ${config.text} ${config.border}`}>
            {withDot && (
                <span className={`size-1.5 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`}></span>
            )}
            {label || status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

export default StatusBadge;
