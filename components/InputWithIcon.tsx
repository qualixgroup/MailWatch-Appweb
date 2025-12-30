
import React from 'react';

interface InputWithIconProps {
    icon: string;
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    required?: boolean;
    className?: string;
    hint?: string;
}

const InputWithIcon: React.FC<InputWithIconProps> = ({
    icon,
    placeholder,
    value,
    onChange,
    type = 'text',
    required = false,
    className = '',
    hint
}) => {
    return (
        <div className="flex flex-col w-full">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-text-dim group-focus-within:text-primary transition-colors">{icon}</span>
                </div>
                <input
                    type={type}
                    required={required}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`w-full rounded-lg bg-background-dark/50 border border-border-dark text-white placeholder-text-dim/50 focus:border-primary focus:ring-1 focus:ring-primary pl-10 pr-4 py-3 transition-all outline-none ${className}`}
                />
            </div>
            {hint && <p className="text-xs text-text-dim mt-1 ml-1">{hint}</p>}
        </div>
    );
};

export default InputWithIcon;
