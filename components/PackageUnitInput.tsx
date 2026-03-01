import React, { useState, useEffect } from 'react';
import { parseToPackageAndUnits, parseToTotalUnits, toEnglishDigits } from '../utils/formatters';
import { ChevronUpIcon, ChevronDownIcon } from './icons';
import { useAppContext } from '../AppContext';

interface PackageUnitInputProps {
    totalUnits: number;
    itemsPerPackage: number;
    onChange: (totalUnits: number) => void;
    className?: string;
    maxUnits?: number;
}

const NumberStepper: React.FC<{ value: string, onChange: (value: string) => void, onIncrement: () => void, onDecrement: () => void, label: string, isError?: boolean, disableIncrement?: boolean }> =
    ({ value, onChange, onIncrement, onDecrement, label, isError, disableIncrement }) => {
    return (
        <div className="flex flex-col items-center">
            <span className={`text-xs mb-1 font-semibold ${isError ? 'text-red-500' : 'text-slate-600'}`}>{label}</span>
            <div className="flex items-center">
                 <input
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => onChange(toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''))}
                    className={`w-16 h-12 text-center border-y border-x-0 z-10 form-input text-lg p-0 ${isError ? 'border-red-500 bg-red-50 text-red-600 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 bg-white focus:ring-blue-500 focus:border-blue-500'}`}
                    placeholder="0"
                />
                <div className="flex flex-col h-12">
                    <button
                        type="button"
                        onClick={onIncrement}
                        disabled={disableIncrement}
                        className={`h-1/2 w-10 flex items-center justify-center transition-colors border-t border-l border-b rounded-l-md rounded-b-none ${isError ? 'bg-red-100 text-red-600 border-red-500 hover:bg-red-200' : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'} ${disableIncrement ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label={`Increment ${label}`}
                    >
                        <ChevronUpIcon className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onDecrement}
                        className={`h-1/2 w-10 flex items-center justify-center transition-colors border-l border-b rounded-l-md rounded-t-none ${isError ? 'bg-red-100 text-red-600 border-red-500 hover:bg-red-200' : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'}`}
                        aria-label={`Decrement ${label}`}
                    >
                        <ChevronDownIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};


const PackageUnitInput: React.FC<PackageUnitInputProps> = ({ totalUnits, itemsPerPackage, onChange, className = '', maxUnits }) => {
    const { storeSettings } = useAppContext();
    const [packages, setPackages] = useState('0');
    const [units, setUnits] = useState('0');
    
    const isPackageMode = itemsPerPackage > 1;

    // Sync with prop changes
    useEffect(() => {
        const { packages: p, units: u } = parseToPackageAndUnits(totalUnits, itemsPerPackage);
        setPackages(String(p));
        setUnits(String(u));
    }, [totalUnits, itemsPerPackage]);

    const processChange = (pVal: number, uVal: number) => {
        const total = parseToTotalUnits(pVal, uVal, itemsPerPackage);
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

    const isError = maxUnits !== undefined && totalUnits > maxUnits;
    const isMaxReached = maxUnits !== undefined && totalUnits >= maxUnits;

    return (
        <div className={`flex flex-col items-center ${className}`}>
            <div className="flex items-start justify-center gap-2">
                {isPackageMode && (
                    <NumberStepper
                        label={storeSettings.packageLabel || "بسته"}
                        value={packages}
                        onChange={handlePackageChange}
                        onIncrement={() => processChange((Number(packages)||0) + 1, Number(units)||0)}
                        onDecrement={() => processChange(Math.max(0, (Number(packages)||0) - 1), Number(units)||0)}
                        isError={isError}
                        disableIncrement={isMaxReached}
                    />
                )}
                 <NumberStepper
                    label={storeSettings.unitLabel || "عدد"}
                    value={units}
                    onChange={handleUnitChange}
                    onIncrement={() => processChange(Number(packages)||0, (Number(units)||0) + 1)}
                    onDecrement={() => processChange(Number(packages)||0, Math.max(0, (Number(units)||0) - 1))}
                    isError={isError}
                    disableIncrement={isMaxReached}
                 />
            </div>
            {isError && (
                <span className="text-[10px] text-red-500 font-bold mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                    موجودی کافی نیست
                </span>
            )}
        </div>
    );
};

export default PackageUnitInput;