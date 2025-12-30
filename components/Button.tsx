
import React from 'react';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    icon?: string;
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    className?: string;
    disabled?: boolean;
    title?: string;
}

const variantClasses = {
    primary: 'bg-primary hover:brightness-110 text-background-dark shadow-lg shadow-primary/20',
    secondary: 'bg-surface-dark border border-border-dark text-white hover:bg-white/5',
    danger: 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20',
    ghost: 'text-text-dim hover:text-white hover:bg-white/5'
};

const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    icon,
    children,
    onClick,
    type = 'button',
    className = '',
    disabled = false,
    title
}) => {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
            {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
            {children}
        </button>
    );
};

export default Button;
