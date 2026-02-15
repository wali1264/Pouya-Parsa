
import React, { useState, useEffect } from 'react';
import { parseToPackageAndUnits, parseToTotalUnits } from '../utils/formatters';
import { ChevronUpIcon, ChevronDownIcon } from './icons';

interface PackageUnitInputProps {
    totalUnits: number;
    itemsPerPackage: number;
    onChange: (totalUnits: number) => void;
    className?: string;
}

const NumberStepper: React.FC<{ value: string, onChange: (value: string) => void, onIncrement: () => void, onDecrement: () => void, label: string }> =
    ({ value, onChange, onIncrement, onDecrement, label }) => {
    return (
        <div className="flex flex-col items-center">
            <span className="text-xs text-slate-600 mb-1 font-semibold">{label}</span>
            <div className="flex items-center">
                 <input
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-16 h-12 text-center border-y border-x-0 border-slate-300 bg-white focus:ring-blue-500 focus:border-blue-500 z-10 form-input text-lg p-0"
                    placeholder="0"
                />
                <div className="flex flex-col h-12">
                    <button
                        type="button"
                        onClick={onIncrement}
                        className="h-1/2 w-10 flex items-center justify-center bg-slate-200 text-slate-700 rounded-l-md rounded-b-none hover:bg-slate-300 transition-colors border-t border-l border-b border-slate-300"
                        aria-label={`Increment ${label}`}
                    >
                        <ChevronUpIcon className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onDecrement}
                        className="h-1/2 w-10 flex items-center justify-center bg-slate-200 text-slate-700 rounded-l-md rounded-t-none hover:bg-slate-300 transition-colors border-l border-b border-slate-300"
                        aria-label={`Decrement ${label}`}
                    >
                        <ChevronDownIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};


const PackageUnitInput: React.FC<PackageUnitInputProps> = ({ totalUnits, itemsPerPackage, onChange, className = '' }) => {
    // We keep local state strings to allow typing, but we normalize them on every significant change
    const [packages, setPackages] = useState('0');
    const [units, setUnits] = useState('0');
    
    const isPackageMode = itemsPerPackage > 1;

    // Sync with prop changes (e.g. from database or other inputs)
    useEffect(() => {
        const { packages: p, units: u } = parseToPackageAndUnits(totalUnits, itemsPerPackage);
        setPackages(String(p));
        setUnits(String(u));
    }, [totalUnits, itemsPerPackage]);

    // Helper to normalize and broadcast changes
    // This calculates the Total, then immediately re-calculates the Packages/Units distribution
    // to create the "snap" effect (e.g. 20 units -> 1 package, 0 units)
    const processChange = (pVal: number, uVal: number) => {
        const total = parseToTotalUnits(pVal, uVal, itemsPerPackage);
        
        // Normalize immediately
        const { packages: normP, units: normU } = parseToPackageAndUnits(total, itemsPerPackage);
        
        setPackages(String(normP));
        setUnits(String(normU));
        
        onChange(total);
    };

    const handlePackageChange = (value: string) => {
        const pVal = Number(value.replace(/[^0-9]/g, '')) || 0;
        const uVal = Number(units) || 0;
        processChange(pVal, uVal);
    };

    const handleUnitChange = (value: string) => {
        const pVal = Number(packages) || 0;
        const uVal = Number(value.replace(/[^0-9]/g, '')) || 0;
        processChange(pVal, uVal);
    };

    return (
        <div className={`flex items-start justify-center gap-2 ${className}`}>
            {isPackageMode && (
                <NumberStepper
                    label="بسته"
                    value={packages}
                    onChange={handlePackageChange}
                    onIncrement={() => processChange((Number(packages)||0) + 1, Number(units)||0)}
                    onDecrement={() => processChange(Math.max(0, (Number(packages)||0) - 1), Number(units)||0)}
                />
            )}
             <NumberStepper
                label="عدد"
                value={units}
                onChange={handleUnitChange}
                onIncrement={() => processChange(Number(packages)||0, (Number(units)||0) + 1)}
                onDecrement={() => processChange(Number(packages)||0, Math.max(0, (Number(units)||0) - 1))}
             />
        </div>
    );
};

export default PackageUnitInput;
