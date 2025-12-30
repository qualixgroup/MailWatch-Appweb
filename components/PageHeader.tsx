
import React from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
    className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, children, className = '' }) => {
    return (
        <div className={`flex flex-col md:flex-row md:items-end justify-between gap-4 ${className}`}>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{title}</h1>
                {description && <p className="text-text-dim max-w-2xl">{description}</p>}
            </div>
            {children && (
                <div className="flex items-center gap-3">
                    {children}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
