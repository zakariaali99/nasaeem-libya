import React from 'react';
import { AlertCircle, CheckCircle } from "lucide-react";

interface FormErrorProps {
  error: string | null;
  validationErrors?: Record<string, string> | any[];
  formTouched?: boolean;
  formValid?: boolean;
  errorRef: React.RefObject<HTMLDivElement>; // Changed from optional to required and removed null
}

export const FormError: React.FC<FormErrorProps> = ({ 
  error, 
  validationErrors = [], 
  formTouched = false, 
  formValid = true,
  errorRef
}) => {
  if (!error && !(formTouched && !formValid)) return null;
  
  return (
    <div ref={errorRef} className="bg-destructive/10 border border-destructive rounded-md p-4">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 ml-2 flex-shrink-0" />
        <div className="flex-grow">
          <h3 className="text-sm font-medium text-destructive">توجد مشكلة في النموذج</h3>
          <div className="mt-2 text-sm text-destructive">
            {error && <p className="mb-2">{error}</p>}
            
            {/* Display validation errors */}
            {formTouched && !formValid && (
              <ul className="list-disc space-y-1 mr-5">
                {Object.entries(validationErrors).map(([key, errorMsg]) => {
                  if (typeof errorMsg === 'string') {
                    return <li key={key}>{`${key}: ${errorMsg}`}</li>;
                  }
                  return null;
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface FormSuccessProps {
  message: string | null;
}

export const FormSuccess: React.FC<FormSuccessProps> = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-4">
      <div className="flex">
        <CheckCircle className="h-5 w-5 text-green-400 ml-2 flex-shrink-0" />
        <div className="mr-3 flex-grow">
          <h3 className="text-sm font-medium text-green-800">تم بنجاح</h3>
          <div className="mt-2 text-sm text-green-700">
            <p>{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
};