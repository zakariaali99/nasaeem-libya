import React from "react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  isMulti?: boolean;
  isSearchable?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, value, onChange, placeholder, isMulti = true, isSearchable = true }) => {
  const [search, setSearch] = React.useState("");
  const filtered = isSearchable && search ? options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase())) : options;

  function handleSelect(val: string) {
    if (isMulti) {
      if (value.includes(val)) {
        onChange(value.filter(v => v !== val));
      } else {
        onChange([...value, val]);
      }
    } else {
      onChange([val]);
    }
  }

  return (
    <div className="relative">
      {isSearchable && (
        <input
          className="w-full border rounded p-2 mb-2"
          placeholder={placeholder || "ابحث..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
          dir="rtl"
        />
      )}
      <div className="max-h-48 overflow-y-auto border rounded bg-background">
        {filtered.length === 0 ? (
          <div className="p-2 text-muted-foreground text-sm">لا توجد نتائج</div>
        ) : (
          filtered.map(opt => (
            <div
              key={opt.value}
              className={`p-2 cursor-pointer flex items-center gap-2 hover:bg-muted ${value.includes(opt.value) ? "bg-primary/10 font-bold" : ""}`}
              onClick={() => handleSelect(opt.value)}
              dir="rtl"
            >
              <input
                type={isMulti ? "checkbox" : "radio"}
                checked={value.includes(opt.value)}
                readOnly
                className="accent-primary"
              />
              <span>{opt.label}</span>
            </div>
          ))
        )}
      </div>
      {isMulti && value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map(val => {
            const opt = options.find(o => o.value === val);
            return opt ? (
              <span key={val} className="bg-primary/10 px-2 py-1 rounded text-xs flex items-center gap-1">
                {opt.label}
                <button type="button" onClick={() => handleSelect(val)} className="ml-1 text-red-500">×</button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};
